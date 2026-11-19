import { NextResponse } from 'next/server'
import { loadAccessContext } from '@/utils/access-control'
import { hasPermission } from '@/utils/permissions'
import { nextAvailableVariantCode, getVariantPhotoMovePaths } from '@/utils/inbound-variant-codes.mjs'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

const PHOTO_BUCKET = 'product-photos'

async function loadAllVariantCodes(admin, modelCode) {
  const codes = []

  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from('dir_product_model_variants')
      .select('variant_code')
      .ilike('variant_code', `${modelCode}-%`)
      .order('variant_code')
      .range(from, from + 999)

    if (error) throw new Error(error.message)
    codes.push(...(data || []).map((row) => row.variant_code))
    if (!data || data.length < 1000) return codes
  }
}

async function photoIsReferenced(admin, photoUrl) {
  const baseUrl = String(photoUrl || '').split('?')[0]
  if (!baseUrl) return false

  for (const [table, column] of [
    ['dir_product_model_variants', 'variant_photo_url'],
    ['inbound_unload', 'photo_url'],
    ['inbound_sample_model_breakdowns', 'photo_url'],
    ['qc_items', 'photo_url'],
    ['qc_confirm', 'photo_url'],
    ['pl_size_breakdown', 'pl_photo_url'],
  ]) {
    const { data, error } = await admin.from(table).select('id').like(column, `${baseUrl}%`).limit(1)
    if (error) throw new Error(error.message)
    if (data?.length) return true
  }

  return false
}

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Sign in again before moving a variant.' }, { status: 401 })

  const access = await loadAccessContext(supabase, user, 'role, display_name')
  if (access.profileError || access.permissionsError || !hasPermission(access.permissions, 'inbound.unload.edit', access.isAdmin)) {
    return NextResponse.json({ error: 'This account cannot move variants between models.' }, { status: 403 })
  }

  const input = await request.json().catch(() => ({}))
  const variantId = Number(input.variantId)
  const targetModelId = Number(input.targetModelId)
  const expectedOldCode = String(input.expectedOldCode || '').trim().toUpperCase()
  const newModelName = String(input.newModel?.name || '').trim().toUpperCase()
  const newModelNotes = String(input.newModel?.notes || '').trim()

  if (!Number.isSafeInteger(variantId) || variantId <= 0 || !expectedOldCode ||
      (!newModelName && (!Number.isSafeInteger(targetModelId) || targetModelId <= 0))) {
    return NextResponse.json({ error: 'Choose a variant and target model.' }, { status: 400 })
  }

  const admin = createAdminClient()
  let createdModel = null
  let preparedPhotoPath = ''
  let committed = false

  try {
    const { data: variant, error: variantError } = await admin
      .from('dir_product_model_variants')
      .select('id, product_model_id, variant_code, variant_name, selling_name, variant_photo_url, is_active')
      .eq('id', variantId)
      .single()
    if (variantError) throw new Error(variantError.message)
    if (!variant.is_active || variant.variant_code !== expectedOldCode) {
      throw new Error('Variant changed while Move Model was open. Refresh and retry.')
    }

    const { data: sourceModel, error: sourceError } = await admin
      .from('dir_product_models')
      .select('id, brand_id, category_id, model_code')
      .eq('id', variant.product_model_id)
      .single()
    if (sourceError) throw new Error(sourceError.message)

    let targetModel
    if (newModelName) {
      const { data: duplicate, error: duplicateError } = await admin
        .from('dir_product_models')
        .select('id')
        .eq('brand_id', sourceModel.brand_id)
        .eq('category_id', sourceModel.category_id)
        .ilike('model_name', newModelName)
        .limit(1)
      if (duplicateError) throw new Error(duplicateError.message)
      if (duplicate?.length) throw new Error('A model with this name already exists. Choose it from the list.')

      const { data, error } = await admin.from('dir_product_models').insert({
        brand_id: sourceModel.brand_id,
        category_id: sourceModel.category_id,
        model_name: newModelName,
        model_notes: newModelNotes || null,
        is_active: true,
      }).select('id, brand_id, category_id, model_code, model_name, model_notes').single()
      if (error) throw new Error(error.message)
      targetModel = data
      createdModel = data
    } else {
      const { data, error } = await admin
        .from('dir_product_models')
        .select('id, brand_id, category_id, model_code, model_name, model_notes, is_active')
        .eq('id', targetModelId)
        .single()
      if (error) throw new Error(error.message)
      targetModel = data
    }

    if (!targetModel?.is_active && !createdModel) throw new Error('Target model is no longer active.')
    if (targetModel.id === sourceModel.id) throw new Error('Choose a different target model.')
    if (targetModel.brand_id !== sourceModel.brand_id || targetModel.category_id !== sourceModel.category_id) {
      throw new Error('Move Model only supports the same brand and category.')
    }

    const targetPrefix = `${targetModel.model_code}-`
    const newCode = expectedOldCode.startsWith(targetPrefix) && /^\d{3}$/.test(expectedOldCode.slice(targetPrefix.length))
      ? expectedOldCode
      : nextAvailableVariantCode(targetModel.model_code, await loadAllVariantCodes(admin, targetModel.model_code))

    let newPhotoUrl = null
    let photoPaths = null
    if (variant.variant_photo_url) {
      photoPaths = getVariantPhotoMovePaths(variant.variant_photo_url, targetModel.model_code, newCode, PHOTO_BUCKET)
      if (photoPaths.sourcePath === photoPaths.destinationPath) {
        newPhotoUrl = variant.variant_photo_url
      } else {
        const { error: copyError } = await admin.storage.from(PHOTO_BUCKET)
          .copy(photoPaths.sourcePath, photoPaths.destinationPath)
        if (copyError) throw new Error(`Could not prepare the new photo: ${copyError.message}`)
        preparedPhotoPath = photoPaths.destinationPath

        const { data: publicUrl } = admin.storage.from(PHOTO_BUCKET).getPublicUrl(preparedPhotoPath)
        newPhotoUrl = `${publicUrl.publicUrl}?rev=${Date.now()}`
      }
    }

    const { error: moveError } = await admin.rpc('move_inbound_variant_model', {
      p_variant_id: variantId,
      p_target_model_id: targetModel.id,
      p_expected_old_code: expectedOldCode,
      p_new_code: newCode,
      p_expected_old_photo_url: variant.variant_photo_url,
      p_new_photo_url: newPhotoUrl,
      p_updated_by: access.profile?.display_name || user.email || 'Inbound coordinator',
    })
    if (moveError) throw new Error(moveError.message)
    committed = true

    const { data: refreshedVariant, error: updatedError } = await admin
      .from('dir_product_model_variants').select('*').eq('id', variantId).single()
    const updatedVariant = updatedError
      ? { ...variant, product_model_id: targetModel.id, variant_code: newCode, variant_photo_url: newPhotoUrl }
      : refreshedVariant

    let warning = updatedError ? 'Model moved, but the latest variant details could not be loaded. Refresh this page.' : ''
    if (photoPaths && photoPaths.sourcePath !== photoPaths.destinationPath) {
      try {
        if (await photoIsReferenced(admin, variant.variant_photo_url)) {
          warning += ' The old photo is still referenced by another record, so its former code cannot be reused yet.'
        } else {
          const { error: removeError } = await admin.storage.from(PHOTO_BUCKET).remove([photoPaths.sourcePath])
          if (removeError) throw new Error(removeError.message)
        }
      } catch {
        warning += ' Model moved, but the old photo could not be cleaned up. Review Storage before reusing its former code.'
      }
    }

    return NextResponse.json({ model: targetModel, variant: updatedVariant, warning })
  } catch (error) {
    if (!committed) {
      if (preparedPhotoPath) {
        const { data: publicUrl } = admin.storage.from(PHOTO_BUCKET).getPublicUrl(preparedPhotoPath)
        if (!await photoIsReferenced(admin, publicUrl.publicUrl).catch(() => true)) {
          await admin.storage.from(PHOTO_BUCKET).remove([preparedPhotoPath])
        }
      }
      if (createdModel) await admin.from('dir_product_models').delete().eq('id', createdModel.id)
    }
    return NextResponse.json({ error: error.message || 'Could not move this variant.' }, { status: committed ? 500 : 409 })
  }
}
