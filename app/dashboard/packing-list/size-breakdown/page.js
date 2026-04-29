'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'

const supabase = createClient()

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '14px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  title: {
    margin: 0,
    fontSize: '28px',
  },
  subtitle: {
    margin: '6px 0 0',
    color: '#6b7280',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '20px',
  },
  sectionSubtitle: {
    margin: '4px 0 0',
    color: '#6b7280',
    fontSize: '14px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '16px',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)',
    gap: '20px',
    alignItems: 'start',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '16px',
  },
  summaryCard: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  summaryLabel: {
    fontSize: '12px',
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#111827',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#111827',
  },
  input: {
    height: '42px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    width: '100%',
    background: '#fff',
  },
  textarea: {
    minHeight: '96px',
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    width: '100%',
    background: '#fff',
    resize: 'vertical',
  },
  readonlyBox: {
    minHeight: '42px',
    padding: '10px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    background: '#f9fafb',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
  },
  featureCard: {
    border: '1px solid #e5e7eb',
    borderRadius: '14px',
    background: '#f9fafb',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  featureImage: {
    width: '100%',
    height: '320px',
    objectFit: 'cover',
    borderRadius: '14px',
    border: '1px solid #e5e7eb',
    background: '#fff',
  },
  variantCard: {
    border: '1px solid #e5e7eb',
    borderRadius: '14px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  variantHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  productIdBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 10px',
    borderRadius: '999px',
    background: '#e0f2fe',
    color: '#075985',
    fontSize: '13px',
    fontWeight: '800',
  },
  sizeRowWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    alignItems: 'flex-start',
  },
  sizeRow: {
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '12px',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(110px, 1fr)) repeat(3, minmax(110px, 1fr)) auto',
    gap: '10px',
    alignItems: 'end',
    width: '100%',
  },
  compactSection: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '10px',
  },
  thumb: {
    width: '88px',
    height: '88px',
    objectFit: 'cover',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    background: '#fff',
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  primaryButton: {
    height: '42px',
    padding: '0 16px',
    border: 'none',
    borderRadius: '8px',
    background: '#111827',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  secondaryButton: {
    height: '42px',
    padding: '0 16px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#fff',
    color: '#111827',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  disabledButton: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  successText: {
    margin: 0,
    color: '#16a34a',
    fontWeight: '600',
  },
  errorText: {
    margin: 0,
    color: '#dc2626',
    fontWeight: '600',
  },
  emptyText: {
    margin: 0,
    color: '#6b7280',
  },
}

function getModelKey(modelName, modelColor) {
  return `${String(modelName || '').trim().toUpperCase()}::${String(modelColor || '').trim().toUpperCase()}`
}

function getModelLabel(item) {
  return item?.model_color ? `${item.model_name} / ${item.model_color}` : item?.model_name || '-'
}

function createEmptySizeRow(index = 0) {
  return {
    id: `size-${Date.now()}-${index}`,
    breakdown_row_id: null,
    size_label: '',
    qty: '',
    weight_value: '',
    length_value: '',
    width_value: '',
    extra_value_1: '',
    extra_value_2: '',
    extra_value_3: '',
  }
}

function parseBaseProductId(variantLabel) {
  const normalized = String(variantLabel || '').trim()
  if (!normalized) return 0
  const [basePart] = normalized.split('.')
  return Number(basePart) || 0
}

function getProductId(baseProductId, variantIndex) {
  return `${baseProductId}.${Math.max(0, Number(variantIndex ?? 0))}`
}

function createVariant(index, baseProductId) {
  return {
    id: `variant-${Date.now()}-${index}`,
    master_variant_id: null,
    variant_index: index,
    variant_label: index === 0 ? 'Main Product' : `Variant ${getProductId(baseProductId, index)}`,
    variant_notes: '',
    variant_photo_url: '',
    extra_headers: ['', '', ''],
    sizeRows: [createEmptySizeRow()],
    product_id: getProductId(baseProductId, index),
  }
}

function normalizeExtraHeaders(headers) {
  const source = Array.isArray(headers) ? headers : []
  return [0, 1, 2].map((index) => String(source[index] || '').toUpperCase())
}

function cloneVariantForCurrentModel(variant, baseProductId, nextIndex) {
  return {
    ...variant,
    id: `variant-clone-${nextIndex}-${variant.id || 'new'}`,
    master_variant_id: null,
    variant_index: nextIndex,
    product_id: getProductId(baseProductId, nextIndex),
    extra_headers: normalizeExtraHeaders(variant.extra_headers),
    sizeRows: (variant.sizeRows || []).map((sizeRow, index) => ({
      ...sizeRow,
      id: `size-clone-${nextIndex}-${index}`,
      breakdown_row_id: null,
    })),
  }
}

function getDefaultMasterVariant(masterVariants, baseProductId) {
  const sorted = [...masterVariants].sort((a, b) => Number(a.variant_index ?? 0) - Number(b.variant_index ?? 0))
  const mainVariant = sorted.find((row) => Number(row.variant_index ?? 0) === 0) || sorted[0] || null

  if (!mainVariant) {
    return [createVariant(0, baseProductId)]
  }

  return sorted.map((row, index) => ({
    id: `master-variant-${row.id || index}`,
    master_variant_id: row.id || null,
    variant_index: Number(row.variant_index ?? index),
    variant_label:
      row.variant_name ||
      (Number(row.variant_index ?? index) === 0 ? 'Main Product' : `Variant ${row.variant_label}`),
    variant_notes: row.variant_notes || '',
    variant_photo_url: row.variant_photo_url || '',
    extra_headers: normalizeExtraHeaders(row.extra_headers),
    sizeRows: [createEmptySizeRow(index)],
    product_id: row.variant_label || getProductId(baseProductId, Number(row.variant_index ?? index)),
  }))
}

export default function PackingListSizeBreakdownPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [validatedRows, setValidatedRows] = useState([])
  const [breakdownRows, setBreakdownRows] = useState([])
  const [confirmRows, setConfirmRows] = useState([])
  const [productModels, setProductModels] = useState([])
  const [productModelVariants, setProductModelVariants] = useState([])
  const [grnFilter, setGrnFilter] = useState('')
  const [selectedModelKey, setSelectedModelKey] = useState('')
  const [referenceModelKey, setReferenceModelKey] = useState('')
  const [variants, setVariants] = useState([createVariant(0, '1')])

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError('')

      const [
        { data: validatedData, error: validatedError },
        { data: breakdownData, error: breakdownError },
        { data: confirmData, error: confirmError },
        { data: productModelData, error: productModelError },
        { data: productVariantData, error: productVariantError },
      ] = await Promise.all([
        supabase
          .from('pl_receiving')
          .select(`
            id,
            inbound_id,
            model_name,
            model_color,
            received_qty,
            qty_diff,
            inbound:inbound_id (
              id,
              grn_number
            )
          `)
          .order('validated_at', { ascending: false }),
        supabase.from('pl_size_breakdown').select('*').order('created_at', { ascending: false }),
        supabase
          .from('qc_confirm')
          .select('inbound_id, model_name, model_color, photo_url')
          .order('created_at', { ascending: false }),
        supabase.from('dir_product_models').select('*').order('created_at', { ascending: false }),
        supabase.from('dir_product_model_variants').select('*').order('created_at', { ascending: false }),
      ])

      if (validatedError || breakdownError || confirmError || productModelError || productVariantError) {
        setError(
          validatedError?.message ||
            breakdownError?.message ||
            confirmError?.message ||
            productModelError?.message ||
            productVariantError?.message ||
            'Failed to load size breakdown data.'
        )
        setLoading(false)
        return
      }

      setValidatedRows(validatedData || [])
      setBreakdownRows(breakdownData || [])
      setConfirmRows(confirmData || [])
      setProductModels(productModelData || [])
      setProductModelVariants(productVariantData || [])
      setLoading(false)
    }

    loadData()
  }, [])

  const grnOptions = useMemo(
    () =>
      Array.from(new Set(validatedRows.map((item) => item.inbound?.grn_number).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [validatedRows]
  )

  const modelOptions = useMemo(() => {
    const photoMap = new Map()
    confirmRows.forEach((row) => {
      const key = `${row.inbound_id}::${getModelKey(row.model_name, row.model_color)}`
      if (!photoMap.has(key) && row.photo_url) {
        photoMap.set(key, row.photo_url)
      }
    })

    const productModelMap = new Map()
    productModels.forEach((row) => {
      productModelMap.set(getModelKey(row.model_name, row.model_color), row)
    })

    const variantRowsByModel = new Map()
    productModelVariants.forEach((row) => {
      const key = Number(row.product_model_id || 0)
      const current = variantRowsByModel.get(key) || []
      current.push(row)
      variantRowsByModel.set(key, current)
    })

    const grouped = new Map()
    validatedRows
      .filter((item) => item.inbound?.grn_number === grnFilter)
      .forEach((item) => {
        const modelKey = getModelKey(item.model_name, item.model_color)
        const key = `${item.inbound_id}::${modelKey}`
        const matchedProductModel = productModelMap.get(modelKey) || null
        const matchedVariantRows = matchedProductModel ? variantRowsByModel.get(Number(matchedProductModel.id)) || [] : []
        const existingBaseId =
          matchedVariantRows.find((row) => Boolean(parseBaseProductId(row.variant_label)))?.variant_label || ''
        const current = grouped.get(key) || {
          key,
          inbound_id: item.inbound_id,
          grn_number: item.inbound?.grn_number || '',
          product_model_id: matchedProductModel?.id || null,
          model_name: item.model_name || '',
          model_color: item.model_color || '',
          model_key: modelKey,
          photo_url: photoMap.get(key) || '',
          received_qty: 0,
          qty_diff: 0,
          base_product_id: '',
        }

        current.received_qty += Number(item.received_qty || 0)
        current.qty_diff += Number(item.qty_diff || 0)
        current.base_product_id =
          current.base_product_id ||
          String(parseBaseProductId(existingBaseId) || Number(matchedProductModel?.id || 0) || grouped.size + 1)
        grouped.set(key, current)
      })

    return Array.from(grouped.values())
      .sort((a, b) => getModelLabel(a).localeCompare(getModelLabel(b)))
  }, [confirmRows, grnFilter, productModelVariants, productModels, validatedRows])

  const selectedModel = modelOptions.find((item) => item.key === selectedModelKey) || null
  const referenceModelOptions = modelOptions.filter((item) => item.key !== selectedModelKey)
  const selectedReferenceModel = referenceModelOptions.find((item) => item.key === referenceModelKey) || null

  function resetFormState(baseProductId = '1') {
    setVariants([createVariant(0, baseProductId)])
  }

  function buildVariantState(model, nextBreakdownRows = breakdownRows, nextMasterVariants = productModelVariants) {
    if (!model) {
      return [createVariant(0, '1')]
    }

    const savedRows = nextBreakdownRows.filter(
      (row) => row.inbound_id === model.inbound_id && getModelKey(row.model_name, row.model_color) === model.model_key
    )

    if (!savedRows.length) {
      const masterVariants = nextMasterVariants
        .filter((row) => Number(row.product_model_id || 0) === Number(model.product_model_id || 0))
        .sort((a, b) => Number(a.variant_index ?? 0) - Number(b.variant_index ?? 0))

      if (!masterVariants.length) {
        return [createVariant(0, model.base_product_id)]
      }

      return getDefaultMasterVariant(masterVariants, model.base_product_id)
    }

    const masterVariantsByIndex = new Map(
      nextMasterVariants
        .filter((row) => Number(row.product_model_id || 0) === Number(model.product_model_id || 0))
        .map((row) => [Number(row.variant_index ?? 0), row])
    )

    const groupedVariants = new Map()
    savedRows.forEach((row, index) => {
      const variantIndex = Number(row.variant_index ?? 0)
      const matchedMasterVariant = masterVariantsByIndex.get(variantIndex) || null
      const current = groupedVariants.get(variantIndex) || {
        id: `saved-variant-${variantIndex}`,
        master_variant_id: matchedMasterVariant?.id || null,
        variant_index: variantIndex,
        variant_label: row.variant_name || row.variant_label || (variantIndex === 0 ? 'Main Product' : `Variant ${row.variant_label}`),
        variant_notes: row.variant_notes || '',
        variant_photo_url: row.variant_photo_url || '',
        extra_headers: normalizeExtraHeaders(row.extra_headers || matchedMasterVariant?.extra_headers),
        sizeRows: [],
        product_id: row.variant_label || getProductId(model.base_product_id, variantIndex),
      }

      current.sizeRows.push({
        id: `saved-size-${row.id || index}`,
        breakdown_row_id: row.id || null,
        size_label: row.size_label || '',
        qty: String(row.qty || ''),
        weight_value: String(row.weight_value || ''),
        length_value: String(row.length_value || ''),
        width_value: String(row.width_value || ''),
        extra_value_1: String(row.extra_value_1 || ''),
        extra_value_2: String(row.extra_value_2 || ''),
        extra_value_3: String(row.extra_value_3 || ''),
      })
      groupedVariants.set(variantIndex, current)
    })

    return Array.from(groupedVariants.values())
      .sort((a, b) => a.variant_index - b.variant_index)
      .map((variant, index) => ({
          ...variant,
          variant_index: index,
          product_id: getProductId(model.base_product_id, index),
        }))
  }

  function hydrateFormState(model, nextBreakdownRows = breakdownRows, nextMasterVariants = productModelVariants) {
    setVariants(buildVariantState(model, nextBreakdownRows, nextMasterVariants))
  }

  const totalEnteredQty = variants.reduce(
    (sum, variant) =>
      sum +
      variant.sizeRows.reduce((variantSum, sizeRow) => variantSum + Number(sizeRow.qty || 0), 0),
    0
  )
  const remainingQty = Number(selectedModel?.received_qty || 0) - totalEnteredQty

  function handleGrnChange(value) {
    setGrnFilter(value)
    setSelectedModelKey('')
    setReferenceModelKey('')
    setError('')
    setSuccess('')
    resetFormState('1')
  }

  function handleModelChange(value) {
    const nextModel = modelOptions.find((item) => item.key === value) || null
    setSelectedModelKey(value)
    setReferenceModelKey('')
    setError('')
    setSuccess('')
    hydrateFormState(nextModel)
  }

  function updateVariant(variantId, updates) {
    setVariants((prev) =>
      prev.map((variant) => (variant.id === variantId ? { ...variant, ...updates } : variant))
    )
  }

  function updateVariantExtraHeader(variantId, headerIndex, value) {
    setVariants((prev) =>
      prev.map((variant) =>
        variant.id === variantId
          ? {
              ...variant,
              extra_headers: normalizeExtraHeaders(
                variant.extra_headers.map((header, index) => (index === headerIndex ? value : header))
              ),
            }
          : variant
      )
    )
  }

  function updateVariantSizeRow(variantId, sizeRowId, updates) {
    setVariants((prev) =>
      prev.map((variant) =>
        variant.id === variantId
          ? {
              ...variant,
              sizeRows: variant.sizeRows.map((sizeRow) =>
                sizeRow.id === sizeRowId ? { ...sizeRow, ...updates } : sizeRow
              ),
            }
          : variant
      )
    )
  }

  function addVariant() {
    if (!selectedModel) return
    setVariants((prev) => {
      const nextIndex = prev.length
      return [...prev, createVariant(nextIndex, selectedModel.base_product_id)]
    })
  }

  function applyReferenceSizeChart() {
    if (!selectedModel || !selectedReferenceModel) return

    const referencedVariants = buildVariantState(selectedReferenceModel)
    const copiedVariants = referencedVariants.map((variant, index) =>
      cloneVariantForCurrentModel(variant, selectedModel.base_product_id, index)
    )

    setVariants(copiedVariants.length ? copiedVariants : [createVariant(0, selectedModel.base_product_id)])
    setSuccess(`Size chart dari ${getModelLabel(selectedReferenceModel)} sudah diterapkan.`)
    setError('')
  }

  function removeVariant(variantId) {
    if (!selectedModel) return
    setVariants((prev) => {
      const remaining = prev.filter((variant) => variant.id !== variantId)
      return remaining.map((variant, index) => ({
        ...variant,
        variant_index: index,
        product_id: getProductId(selectedModel.base_product_id, index),
      }))
    })
  }

  function addSizeRow(variantId) {
    setVariants((prev) =>
      prev.map((variant) =>
        variant.id === variantId
          ? {
              ...variant,
              sizeRows: [...variant.sizeRows, createEmptySizeRow(variant.sizeRows.length)],
            }
          : variant
      )
    )
  }

  function removeSizeRow(variantId, sizeRowId) {
    setVariants((prev) =>
      prev.map((variant) =>
        variant.id === variantId
          ? {
              ...variant,
              sizeRows: variant.sizeRows.filter((sizeRow) => sizeRow.id !== sizeRowId),
            }
          : variant
      )
    )
  }

  async function handleVariantPhotoChange(variantId, event) {
    const file = event.target.files?.[0]
    if (!file) return

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('Failed to read variant photo.'))
      reader.readAsDataURL(file)
    })

    updateVariant(variantId, { variant_photo_url: dataUrl })
  }

  async function saveBreakdown() {
    if (!selectedModel) {
      setError('Choose GRN and Model first.')
      setSuccess('')
      return
    }

    if (!selectedModel.product_model_id) {
      setError('Product model master belum ditemukan untuk model ini.')
      setSuccess('')
      return
    }

    const invalidVariant = variants.find((variant) => {
      if (!String(variant.variant_label || '').trim()) return true
      if ((variant.extra_headers || []).some((header) => header && !String(header).trim())) return true
      return variant.sizeRows.some(
        (sizeRow) =>
          !String(sizeRow.size_label || '').trim() ||
          Number(sizeRow.qty || 0) <= 0 ||
          !String(sizeRow.weight_value || '').trim() ||
          !String(sizeRow.length_value || '').trim() ||
          !String(sizeRow.width_value || '').trim()
      )
    })

    if (invalidVariant) {
      setError('Complete every variant, size, and qty before saving.')
      setSuccess('')
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const normalizedVariants = variants.map((variant, index) => ({
      ...variant,
      variant_index: index,
      product_id: getProductId(selectedModel.base_product_id, index),
    }))

    const payload = normalizedVariants.flatMap((variant) =>
      variant.sizeRows.map((sizeRow) => ({
        id: sizeRow.breakdown_row_id || null,
        inbound_id: selectedModel.inbound_id,
        source_koli_sequence: 0,
        model_name: selectedModel.model_name,
        model_color: selectedModel.model_color || null,
        variant_index: variant.variant_index,
        variant_label: variant.product_id,
        variant_name: String(variant.variant_label || '').trim(),
        variant_notes: String(variant.variant_notes || '').trim() || null,
        variant_photo_url: variant.variant_photo_url || null,
        size_label: String(sizeRow.size_label || '').trim(),
        qty: Number(sizeRow.qty || 0),
        weight_value: String(sizeRow.weight_value || '').trim() || null,
        length_value: String(sizeRow.length_value || '').trim() || null,
        width_value: String(sizeRow.width_value || '').trim() || null,
        extra_headers: normalizeExtraHeaders(variant.extra_headers).filter(Boolean),
        extra_value_1: String(sizeRow.extra_value_1 || '').trim() || null,
        extra_value_2: String(sizeRow.extra_value_2 || '').trim() || null,
        extra_value_3: String(sizeRow.extra_value_3 || '').trim() || null,
        created_by: user?.email || null,
      }))
    )

    const masterVariantPayload = normalizedVariants.map((variant) => ({
      id: variant.master_variant_id || null,
      product_model_id: selectedModel.product_model_id,
      variant_index: variant.variant_index,
      variant_label: variant.product_id,
      variant_name: String(variant.variant_label || '').trim() || null,
      variant_notes: String(variant.variant_notes || '').trim() || null,
      variant_photo_url: variant.variant_photo_url || null,
      extra_headers: normalizeExtraHeaders(variant.extra_headers).filter(Boolean),
      is_main_variant: variant.variant_index === 0,
      is_active: true,
    }))

    setSaving(true)
    setError('')
    setSuccess('')

    const existingMasterVariants = productModelVariants.filter(
      (row) => Number(row.product_model_id || 0) === Number(selectedModel.product_model_id || 0)
    )
    const incomingMasterVariantIds = new Set(masterVariantPayload.map((row) => Number(row.id || 0)).filter(Boolean))
    const staleMasterVariants = existingMasterVariants.filter((row) => !incomingMasterVariantIds.has(Number(row.id || 0)))

    const existingMasterVariantIds = new Set(existingMasterVariants.map((row) => Number(row.id || 0)).filter(Boolean))
    const renumberedMasterVariants = masterVariantPayload.filter((row) => existingMasterVariantIds.has(Number(row.id || 0)))

    for (const variantRow of renumberedMasterVariants) {
      const temporaryVariantLabel = `TMP-${variantRow.id}`
      const { error: tempVariantError } = await supabase
        .from('dir_product_model_variants')
        .update({
          variant_label: temporaryVariantLabel,
          variant_index: 9999 + Number(variantRow.variant_index || 0),
        })
        .eq('id', variantRow.id)

      if (tempVariantError) {
        setSaving(false)
        setError(tempVariantError.message || 'Failed to prepare master product variant update.')
        return
      }
    }

    for (const variantRow of masterVariantPayload) {
      const variantPayload = {
        product_model_id: variantRow.product_model_id,
        variant_index: variantRow.variant_index,
        variant_label: variantRow.variant_label,
        variant_name: variantRow.variant_name,
        variant_notes: variantRow.variant_notes,
        variant_photo_url: variantRow.variant_photo_url,
        extra_headers: variantRow.extra_headers,
        is_main_variant: variantRow.is_main_variant,
        is_active: variantRow.is_active,
      }

      const query = variantRow.id
        ? supabase.from('dir_product_model_variants').update(variantPayload).eq('id', variantRow.id)
        : supabase.from('dir_product_model_variants').insert([variantPayload])

      const { error: masterVariantError } = await query

      if (masterVariantError) {
        setSaving(false)
        setError(masterVariantError.message || 'Failed to save master product variants.')
        return
      }
    }

    for (const staleVariant of staleMasterVariants) {
      const { error: deleteMasterVariantError } = await supabase
        .from('dir_product_model_variants')
        .delete()
        .eq('id', staleVariant.id)

      if (deleteMasterVariantError) {
        setSaving(false)
        setError(deleteMasterVariantError.message || 'Failed to remove deleted master variant.')
        return
      }
    }

    const existingBreakdownRows = breakdownRows.filter(
      (row) =>
        row.inbound_id === selectedModel.inbound_id &&
        row.model_name === selectedModel.model_name &&
        String(row.model_color || '') === String(selectedModel.model_color || '')
    )
    const incomingBreakdownIds = new Set(payload.map((row) => Number(row.id || 0)).filter(Boolean))
    const staleBreakdownRows = existingBreakdownRows.filter((row) => !incomingBreakdownIds.has(Number(row.id || 0)))

    for (const row of payload) {
      const breakdownPayload = {
        inbound_id: row.inbound_id,
        source_koli_sequence: row.source_koli_sequence,
        model_name: row.model_name,
        model_color: row.model_color,
        variant_index: row.variant_index,
        variant_label: row.variant_label,
        variant_name: row.variant_name,
        variant_notes: row.variant_notes,
        variant_photo_url: row.variant_photo_url,
        weight_value: row.weight_value,
        length_value: row.length_value,
        width_value: row.width_value,
        extra_headers: row.extra_headers,
        extra_value_1: row.extra_value_1,
        extra_value_2: row.extra_value_2,
        extra_value_3: row.extra_value_3,
        size_label: row.size_label,
        qty: row.qty,
        created_by: row.created_by,
      }

      const query = row.id
        ? supabase.from('pl_size_breakdown').update(breakdownPayload).eq('id', row.id)
        : supabase.from('pl_size_breakdown').insert([breakdownPayload])

      const { error: breakdownError } = await query

      if (breakdownError) {
        setSaving(false)
        setError(breakdownError.message || 'Failed to save size breakdown.')
        return
      }
    }

    for (const staleRow of staleBreakdownRows) {
      const { error: deleteBreakdownError } = await supabase
        .from('pl_size_breakdown')
        .delete()
        .eq('id', staleRow.id)

      if (deleteBreakdownError) {
        setSaving(false)
        setError(deleteBreakdownError.message || 'Failed to remove deleted size breakdown row.')
        return
      }
    }

    const [
      { data: refreshedMasterVariants, error: refreshMasterVariantsError },
      { data: refreshedBreakdownRows, error: refreshBreakdownRowsError },
    ] = await Promise.all([
      supabase
        .from('dir_product_model_variants')
        .select('*')
        .eq('product_model_id', selectedModel.product_model_id)
        .order('variant_index', { ascending: true }),
      selectedModel.model_color
        ? supabase
            .from('pl_size_breakdown')
            .select('*')
            .eq('inbound_id', selectedModel.inbound_id)
            .eq('model_name', selectedModel.model_name)
            .eq('model_color', selectedModel.model_color)
            .order('variant_index', { ascending: true })
            .order('id', { ascending: true })
        : supabase
            .from('pl_size_breakdown')
            .select('*')
            .eq('inbound_id', selectedModel.inbound_id)
            .eq('model_name', selectedModel.model_name)
            .is('model_color', null)
            .order('variant_index', { ascending: true })
            .order('id', { ascending: true }),
    ])

    setSaving(false)

    if (refreshMasterVariantsError || refreshBreakdownRowsError) {
      setError(refreshMasterVariantsError?.message || refreshBreakdownRowsError?.message || 'Failed to refresh saved size breakdown.')
      return
    }

    const nextMasterVariants = [
      ...(productModelVariants.filter((row) => Number(row.product_model_id || 0) !== Number(selectedModel.product_model_id || 0))),
      ...((refreshedMasterVariants || []).filter(Boolean)),
    ]

    const nextBreakdownRows = [
      ...(breakdownRows.filter(
        (row) =>
          !(
            row.inbound_id === selectedModel.inbound_id &&
            row.model_name === selectedModel.model_name &&
            String(row.model_color || '') === String(selectedModel.model_color || '')
          )
      )),
      ...((refreshedBreakdownRows || []).filter(Boolean)),
    ]

    setProductModelVariants(nextMasterVariants)
    setBreakdownRows(nextBreakdownRows)
    hydrateFormState(selectedModel, nextBreakdownRows, nextMasterVariants)

    setSuccess('Size breakdown dan master variant berhasil disimpan.')
  }

  if (loading) {
    return <p style={styles.emptyText}>Loading size breakdown...</p>
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div>
          <h1 style={styles.title}>Size Breakdown</h1>
          <p style={styles.subtitle}>
            Break down validated Packing List receiving qty into sizes. Kalau ada detail fisik berbeda, cukup tambahkan variant baru, tanpa flow SKU dan tanpa review.
          </p>
        </div>

        <div style={styles.grid}>
          <div style={styles.field}>
            <label style={styles.label}>GRN Number</label>
            <input
              list="packing-list-size-breakdown-grn-options"
              value={grnFilter}
              onChange={(event) => handleGrnChange(event.target.value)}
              style={styles.input}
              placeholder="Type or choose GRN Number"
            />
            <datalist id="packing-list-size-breakdown-grn-options">
              {grnOptions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Available Models</label>
            <div style={styles.readonlyBox}>{grnFilter ? modelOptions.length : 0}</div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Selected Model</label>
            <div style={styles.readonlyBox}>{selectedModel ? getModelLabel(selectedModel) : '-'}</div>
          </div>
        </div>

        {error ? <p style={styles.errorText}>{error}</p> : null}
        {success ? <p style={styles.successText}>{success}</p> : null}
      </div>

      <div style={styles.card}>
        <div>
          <h2 style={styles.sectionTitle}>Choose Model</h2>
          <p style={styles.sectionSubtitle}>Model di bawah ini sudah digabung dari semua koli pada GRN yang dipilih.</p>
        </div>

        <div style={styles.grid}>
          <div style={styles.field}>
            <label style={styles.label}>Model</label>
            {grnFilter ? (
              <select value={selectedModelKey} onChange={(event) => handleModelChange(event.target.value)} style={styles.input}>
                <option value="">Choose Model</option>
                {modelOptions.map((item) => (
                  <option key={item.key} value={item.key}>
                    {getModelLabel(item)} | Qty {item.received_qty} | Gap {item.qty_diff > 0 ? `+${item.qty_diff}` : item.qty_diff}
                  </option>
                ))}
              </select>
            ) : (
              <div style={styles.readonlyBox}>Choose GRN first</div>
            )}
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Base Product ID</label>
            <div style={styles.readonlyBox}>{selectedModel ? selectedModel.base_product_id : '-'}</div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Selected Qty</label>
            <div style={styles.readonlyBox}>{selectedModel ? selectedModel.received_qty : '-'}</div>
          </div>
        </div>

        <div style={styles.grid}>
          <div style={styles.field}>
            <label style={styles.label}>Refer Size Chart From</label>
            {selectedModel ? (
              <select value={referenceModelKey} onChange={(event) => setReferenceModelKey(event.target.value)} style={styles.input}>
                <option value="">Choose Model From Same GRN</option>
                {referenceModelOptions.map((item) => (
                  <option key={item.key} value={item.key}>
                    {getModelLabel(item)}
                  </option>
                ))}
              </select>
            ) : (
              <div style={styles.readonlyBox}>Choose model first</div>
            )}
          </div>

          <div style={{ ...styles.field, justifyContent: 'end' }}>
            <label style={styles.label}>Shortcut</label>
            <button
              type="button"
              onClick={applyReferenceSizeChart}
              disabled={!selectedModel || !selectedReferenceModel}
              style={
                !selectedModel || !selectedReferenceModel
                  ? { ...styles.secondaryButton, ...styles.disabledButton }
                  : styles.secondaryButton
              }
            >
              Apply Referenced Size Chart
            </button>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <div>
          <h2 style={styles.sectionTitle}>Breakdown Form</h2>
          <p style={styles.sectionSubtitle}>Produk utama memakai ID dasar `1.0`, lalu variant tambahan otomatis jadi `1.1`, `1.2`, dan seterusnya.</p>
        </div>

        {!selectedModel ? <p style={styles.emptyText}>Choose a model first.</p> : null}

        {selectedModel ? (
          <>
            <div style={styles.summaryGrid}>
              <div style={styles.summaryCard}>
                <span style={styles.summaryLabel}>Selected Model</span>
                <strong style={{ ...styles.summaryValue, fontSize: '18px' }}>{getModelLabel(selectedModel)}</strong>
              </div>
              <div style={styles.summaryCard}>
                <span style={styles.summaryLabel}>Received Qty</span>
                <strong style={styles.summaryValue}>{selectedModel.received_qty}</strong>
              </div>
              <div style={styles.summaryCard}>
                <span style={styles.summaryLabel}>Entered Variant Qty</span>
                <strong style={styles.summaryValue}>{totalEnteredQty}</strong>
              </div>
              <div style={styles.summaryCard}>
                <span style={styles.summaryLabel}>Remaining Qty</span>
                <strong style={{ ...styles.summaryValue, color: remainingQty === 0 ? '#111827' : '#dc2626' }}>{remainingQty}</strong>
              </div>
            </div>

            <div style={styles.formGrid}>
              <div style={styles.featureCard}>
                {selectedModel.photo_url ? (
                  <Image src={selectedModel.photo_url} alt={getModelLabel(selectedModel)} width={360} height={320} unoptimized style={styles.featureImage} />
                ) : (
                  <div style={{ ...styles.featureImage, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>No Photo</div>
                )}
                <strong>{getModelLabel(selectedModel)}</strong>
                <span>GRN: {selectedModel.grn_number || '-'}</span>
                <span>Qty Different: {selectedModel.qty_diff > 0 ? `+${selectedModel.qty_diff}` : selectedModel.qty_diff}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {variants.map((variant) => (
                  <div key={variant.id} style={styles.variantCard}>
                    <div style={styles.variantHeader}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px', flex: 1 }}>
                        <label style={styles.label}>Variant Name</label>
                        <input
                          value={variant.variant_label}
                          onChange={(event) => updateVariant(variant.id, { variant_label: event.target.value })}
                          style={styles.input}
                          placeholder={variant.variant_index === 0 ? 'Main Product' : 'Contoh: Tali Pendek'}
                        />
                      </div>
                      <span style={styles.productIdBadge}>Product ID: {variant.product_id}</span>
                    </div>

                    <div style={styles.grid}>
                      <div style={styles.field}>
                        <label style={styles.label}>Variant Notes</label>
                        <textarea
                          value={variant.variant_notes}
                          onChange={(event) => updateVariant(variant.id, { variant_notes: event.target.value })}
                          style={styles.textarea}
                          placeholder="Catatan perbedaan fisik variant ini."
                        />
                      </div>

                      <div style={styles.field}>
                        <label style={styles.label}>Variant Photo</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => handleVariantPhotoChange(variant.id, event)}
                          style={styles.input}
                        />
                        {variant.variant_photo_url ? (
                          <Image src={variant.variant_photo_url} alt={variant.variant_label} width={88} height={88} unoptimized style={styles.thumb} />
                        ) : null}
                      </div>

                      <div style={styles.field}>
                        <label style={styles.label}>Variant Qty</label>
                        <div style={styles.readonlyBox}>
                          {variant.sizeRows.reduce((sum, row) => sum + Number(row.qty || 0), 0)}
                        </div>
                      </div>
                    </div>

                    <div style={styles.field}>
                      <label style={styles.label}>Optional Measurement Headers</label>
                      <div style={styles.compactSection}>
                        {[0, 1, 2].map((headerIndex) => (
                          <div key={`${variant.id}-header-${headerIndex}`} style={styles.field}>
                            <label style={styles.label}>Header {headerIndex + 1}</label>
                            <input
                              value={variant.extra_headers?.[headerIndex] || ''}
                              onChange={(event) =>
                                updateVariantExtraHeader(
                                  variant.id,
                                  headerIndex,
                                  String(event.target.value || '').toUpperCase()
                                )
                              }
                              style={styles.input}
                              placeholder={headerIndex === 0 ? 'PANJANG LENGAN' : `HEADER ${headerIndex + 1}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={styles.field}>
                      <label style={styles.label}>Size Rows</label>
                      <div style={styles.sizeRowWrap}>
                        {variant.sizeRows.map((sizeRow) => (
                          <div key={sizeRow.id} style={styles.sizeRow}>
                            <div style={styles.field}>
                              <label style={styles.label}>Size</label>
                              <input
                                value={sizeRow.size_label}
                                onChange={(event) =>
                                  updateVariantSizeRow(variant.id, sizeRow.id, {
                                    size_label: String(event.target.value || '').toUpperCase(),
                                  })
                                }
                                style={styles.input}
                                placeholder="S / M / L"
                              />
                            </div>

                            <div style={styles.field}>
                              <label style={styles.label}>Qty</label>
                              <input
                                type="number"
                                min="0"
                                value={sizeRow.qty}
                                onChange={(event) =>
                                  updateVariantSizeRow(variant.id, sizeRow.id, { qty: event.target.value })
                                }
                                style={styles.input}
                              />
                            </div>

                            <div style={styles.field}>
                              <label style={styles.label}>Berat</label>
                              <input
                                value={sizeRow.weight_value}
                                onChange={(event) =>
                                  updateVariantSizeRow(variant.id, sizeRow.id, { weight_value: event.target.value })
                                }
                                style={styles.input}
                                placeholder="0"
                              />
                            </div>

                            <div style={styles.field}>
                              <label style={styles.label}>Panjang</label>
                              <input
                                value={sizeRow.length_value}
                                onChange={(event) =>
                                  updateVariantSizeRow(variant.id, sizeRow.id, { length_value: event.target.value })
                                }
                                style={styles.input}
                                placeholder="0"
                              />
                            </div>

                            <div style={styles.field}>
                              <label style={styles.label}>Lebar</label>
                              <input
                                value={sizeRow.width_value}
                                onChange={(event) =>
                                  updateVariantSizeRow(variant.id, sizeRow.id, { width_value: event.target.value })
                                }
                                style={styles.input}
                                placeholder="0"
                              />
                            </div>

                            {[0, 1, 2].map((headerIndex) =>
                              variant.extra_headers?.[headerIndex] ? (
                                <div key={`${sizeRow.id}-extra-${headerIndex}`} style={styles.field}>
                                  <label style={styles.label}>{variant.extra_headers[headerIndex]}</label>
                                  <input
                                    value={sizeRow[`extra_value_${headerIndex + 1}`]}
                                    onChange={(event) =>
                                      updateVariantSizeRow(variant.id, sizeRow.id, {
                                        [`extra_value_${headerIndex + 1}`]: event.target.value,
                                      })
                                    }
                                    style={styles.input}
                                    placeholder={variant.extra_headers[headerIndex]}
                                  />
                                </div>
                              ) : null
                            )}

                            <div style={styles.buttonRow}>
                              <button
                                type="button"
                                onClick={() => removeSizeRow(variant.id, sizeRow.id)}
                                style={variant.sizeRows.length === 1 ? { ...styles.secondaryButton, ...styles.disabledButton } : styles.secondaryButton}
                                disabled={variant.sizeRows.length === 1}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={styles.buttonRow}>
                      <button type="button" onClick={() => addSizeRow(variant.id)} style={styles.secondaryButton}>
                        + Add Size Row
                      </button>
                      <button
                        type="button"
                        onClick={() => removeVariant(variant.id)}
                        style={variants.length === 1 ? { ...styles.secondaryButton, ...styles.disabledButton } : styles.secondaryButton}
                        disabled={variants.length === 1}
                      >
                        Remove Variant
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.buttonRow}>
              <button type="button" onClick={addVariant} style={styles.secondaryButton}>
                + Add Variant
              </button>
              <button
                type="button"
                onClick={saveBreakdown}
                style={saving ? { ...styles.primaryButton, ...styles.disabledButton } : styles.primaryButton}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Size Breakdown'}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
