'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'

const supabase = createClient()

function sanitizeQuantityInput(value) {
  return String(value || '').replace(/\D/g, '')
}

function normalize(value) {
  return String(value || '').trim().toUpperCase()
}

function normalizeSizeLabel(value) {
  return normalize(value).replace(/\s+/g, '')
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0))
}

function getDisplayName(user, profile) {
  return normalize(
    String(profile?.display_name || '').trim() ||
      String(user?.user_metadata?.display_name || '').trim() ||
      String(user?.user_metadata?.full_name || '').trim() ||
      String(user?.user_metadata?.name || '').trim() ||
      String(user?.email || '').split('@')[0] ||
      'Packing Staff'
  )
}

function getItemName(row = {}) {
  const plName = String(row.pl_name || '').trim()
  if (plName) return plName

  const modelName = String(row.model_name || '').trim()
  const variantName = String(row.variant_name || '').trim()
  return variantName ? `${modelName} / ${variantName}` : modelName || 'PL Item'
}

function getPhotoKey(row = {}) {
  return `${Number(row.inbound_id || 0)}::${normalize(row.model_name)}::${normalize(row.variant_name)}`
}

function getProductKey(row = {}) {
  return [
    row.product_model_id || 'model',
    row.product_model_variant_id || 'variant',
    row.pl_detail_seq || row.detail_order || 'base',
    normalize(row.pl_name || row.variant_name || row.model_name),
  ].join(':')
}

function getAllocationIdentity(row = {}) {
  if (row.product_model_variant_id) return `VARIANT:${row.product_model_variant_id}`
  if (row.product_model_id) return `MODEL:${row.product_model_id}`
  return `LEGACY:${normalize(row.model_name)}:${normalize(row.variant_name)}`
}

function getDefaultTargetQty(rowQty = 0, modelVariantQty = 0, storingType = 'MOB') {
  const normalizedQty = Math.max(0, Number(rowQty || 0))
  if (modelVariantQty <= 15) return storingType === 'OI' ? normalizedQty : 0
  if (modelVariantQty <= 80) return storingType === 'MOB' ? normalizedQty : 0

  const oiTargetQty = Math.ceil(normalizedQty * 0.15)
  return storingType === 'OI' ? oiTargetQty : Math.max(0, normalizedQty - oiTargetQty)
}

function getStoredOrDefaultTargetQty(row = {}, modelVariantQty = 0, storingType = 'MOB') {
  const field = storingType === 'OI' ? 'oi_target_qty' : 'mob_target_qty'
  if (row[field] !== null && row[field] !== undefined) {
    return Math.max(0, Number(row[field] || 0))
  }
  return getDefaultTargetQty(row.qty, modelVariantQty, storingType)
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  )
}

function preventNumberWheel(event) {
  event.currentTarget.blur()
}

export default function ItemStoringPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const grnNumber = searchParams.get('grn') || ''
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [inbound, setInbound] = useState(null)
  const [breakdownRows, setBreakdownRows] = useState([])
  const [packingRows, setPackingRows] = useState([])
  const [modelRows, setModelRows] = useState([])
  const [variantRows, setVariantRows] = useState([])
  const [confirmRows, setConfirmRows] = useState([])
  const [brandRows, setBrandRows] = useState([])
  const [storingType, setStoringType] = useState('MOB')
  const [packageType, setPackageType] = useState('REGULAR')
  const [selectedProductKey, setSelectedProductKey] = useState('')
  const [selectedBreakdownId, setSelectedBreakdownId] = useState('')
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const [qty, setQty] = useState('')
  const [draftItems, setDraftItems] = useState([])
  const [postedCard, setPostedCard] = useState(null)
  const [previewPhoto, setPreviewPhoto] = useState(null)
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const displayName = getDisplayName(user, profile)
  const brandById = useMemo(() => new Map(brandRows.map((brand) => [Number(brand.id || 0), brand])), [brandRows])
  const brandByModelId = useMemo(() => new Map(modelRows.map((model) => [Number(model.id || 0), Number(model.brand_id || 0)])), [modelRows])
  const photoByVariantId = useMemo(() => new Map(variantRows.map((variant) => [Number(variant.id || 0), variant.variant_photo_url || variant.photo_url || ''])), [variantRows])
  const photoByConfirmKey = useMemo(() => {
    const nextMap = new Map()
    confirmRows.forEach((row) => {
      const key = getPhotoKey({
        inbound_id: row.inbound_id,
        model_name: row.model_name,
        variant_name: row.model_color,
      })
      if (!nextMap.has(key) && row.photo_url) {
        nextMap.set(key, row.photo_url)
      }
    })
    return nextMap
  }, [confirmRows])

  const modelVariantQtyByIdentity = useMemo(() => {
    return breakdownRows.reduce((result, row) => {
      const key = getAllocationIdentity(row)
      result.set(key, (result.get(key) || 0) + Math.max(0, Number(row.qty || 0)))
      return result
    }, new Map())
  }, [breakdownRows])

  const packedQtyByTargetKey = useMemo(() => {
    return packingRows.reduce((result, row) => {
      const key = `${Number(row.pl_size_breakdown_id || 0)}::${normalize(row.storing_type)}`
      result.set(key, (result.get(key) || 0) + Number(row.qty || 0))
      return result
    }, new Map())
  }, [packingRows])

  const draftQtyByTargetKey = useMemo(() => {
    return draftItems.reduce((result, row) => {
      const key = `${Number(row.breakdown_id || 0)}::${storingType}`
      result.set(key, (result.get(key) || 0) + Number(row.qty || 0))
      return result
    }, new Map())
  }, [draftItems, storingType])

  const enrichedRows = useMemo(() => {
    return breakdownRows
      .filter((row) => Number(row.qty || 0) > 0)
      .map((row) => {
        const brandId = Number(row.brand_id || brandByModelId.get(Number(row.product_model_id || 0)) || 0) || null
        const brand = brandById.get(Number(brandId || 0)) || null
        const targetKey = `${Number(row.id || 0)}::${storingType}`
        const packedQty = packedQtyByTargetKey.get(targetKey) || 0
        const draftQty = draftQtyByTargetKey.get(targetKey) || 0
        const modelVariantQty = modelVariantQtyByIdentity.get(getAllocationIdentity(row)) || 0
        const targetQty = getStoredOrDefaultTargetQty(row, modelVariantQty, storingType)

        return {
          ...row,
          product_key: getProductKey(row),
          item_name: getItemName(row),
          size_label: normalizeSizeLabel(row.size_label),
          brand_id: brandId,
          brand_name: brand?.brand_name || brand?.name || 'UNBRANDED',
          photo_url:
            row.pl_photo_url ||
            row.variant_photo_url ||
            photoByVariantId.get(Number(row.product_model_variant_id || 0)) ||
            photoByConfirmKey.get(getPhotoKey(row)) ||
            '',
          breakdown_qty: targetQty,
          packed_qty: packedQty,
          draft_qty: draftQty,
          remaining_qty: Math.max(0, targetQty - packedQty - draftQty),
        }
      })
      .filter((row) => Number(row.breakdown_qty || 0) > 0)
  }, [brandById, brandByModelId, breakdownRows, draftQtyByTargetKey, modelVariantQtyByIdentity, packedQtyByTargetKey, photoByConfirmKey, photoByVariantId, storingType])

  const products = useMemo(() => {
    const grouped = new Map()
    enrichedRows.forEach((row) => {
      const current = grouped.get(row.product_key) || {
        key: row.product_key,
        item_name: row.item_name,
        brand_id: row.brand_id,
        brand_name: row.brand_name,
        photo_url: row.photo_url,
        total_qty: 0,
        remaining_qty: 0,
        rows: [],
      }
      current.total_qty += Number(row.breakdown_qty || 0)
      current.remaining_qty += Number(row.remaining_qty || 0)
      current.photo_url = current.photo_url || row.photo_url
      current.rows.push(row)
      grouped.set(row.product_key, current)
    })

    return Array.from(grouped.values()).sort((a, b) => a.item_name.localeCompare(b.item_name))
  }, [enrichedRows])

  const selectedProduct = products.find((item) => item.key === selectedProductKey) || null
  const sizeOptions = useMemo(() => selectedProduct?.rows || [], [selectedProduct])
  const selectedSize = sizeOptions.find((item) => String(item.id) === String(selectedBreakdownId)) || null
  const currentKoliLabel = `${storingType}, ${packageType === 'PHOTO' ? 'Foto' : 'Regular'}`

  useEffect(() => {
    let mounted = true

    async function loadData() {
      setLoading(true)
      setError('')

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!authUser) {
        router.push('/login')
        return
      }

      const profileResult = await getProfileByAuthenticatedUser(supabase, authUser, 'id, email, display_name, role')
      const { data: inboundRow, error: inboundError } = await supabase
        .from('inbound')
        .select('id, grn_number, inbound_date, item_name')
        .eq('grn_number', grnNumber)
        .maybeSingle()

      if (!mounted) return

      if (inboundError || !inboundRow) {
        setUser(authUser)
        setProfile(profileResult.data || null)
        setInbound(null)
        setError(inboundError?.message || 'GRN is not available for Item Storing.')
        setLoading(false)
        return
      }

      const [
        { data: breakdownData, error: breakdownError },
        { data: packingData, error: packingError },
        { data: productModelData, error: productModelError },
        { data: variantData, error: variantError },
        { data: confirmData, error: confirmError },
        { data: brandData, error: brandError },
      ] = await Promise.all([
        supabase
          .from('pl_size_breakdown')
          .select('*')
          .eq('inbound_id', inboundRow.id)
          .gt('qty', 0)
          .order('detail_order', { ascending: true })
          .order('id', { ascending: true }),
        supabase
          .from('pl_packing_items')
          .select('*')
          .eq('inbound_id', inboundRow.id)
          .order('created_at', { ascending: true }),
        supabase.from('dir_product_models').select('id, brand_id'),
        supabase.from('dir_product_model_variants').select('*'),
        supabase
          .from('qc_confirm')
          .select('inbound_id, model_name, model_color:variant_name, photo_url')
          .eq('inbound_id', inboundRow.id)
          .order('created_at', { ascending: false }),
        supabase.from('dir_brands').select('*'),
      ])

      if (!mounted) return

      if (breakdownError || packingError || productModelError || variantError || confirmError || brandError) {
        setError(breakdownError?.message || packingError?.message || productModelError?.message || variantError?.message || confirmError?.message || brandError?.message || 'Failed to load Item Storing.')
        setLoading(false)
        return
      }

      setUser(authUser)
      setProfile(profileResult.data || null)
      setInbound(inboundRow)
      setBreakdownRows(breakdownData || [])
      setPackingRows(packingData || [])
      setModelRows(productModelData || [])
      setVariantRows(variantData || [])
      setConfirmRows(confirmData || [])
      setBrandRows(brandData || [])
      setLoading(false)
    }

    loadData()

    return () => {
      mounted = false
    }
  }, [grnNumber, router])

  useEffect(() => {
    if (!selectedProductKey) return
    if (products.some((item) => item.key === selectedProductKey)) return
    setSelectedProductKey('')
    setSelectedBreakdownId('')
  }, [products, selectedProductKey])

  useEffect(() => {
    if (!selectedBreakdownId) return
    if (sizeOptions.some((item) => String(item.id) === String(selectedBreakdownId))) return
    setSelectedBreakdownId('')
  }, [selectedBreakdownId, sizeOptions])

  async function reloadPackingRows(inboundId) {
    const { data, error: reloadError } = await supabase
      .from('pl_packing_items')
      .select('*')
      .eq('inbound_id', inboundId)
      .order('created_at', { ascending: true })

    if (reloadError) throw reloadError

    setPackingRows(data || [])
    return data || []
  }

  function setToggle(type, value) {
    if (draftItems.length) {
      setError('Post or clear the current koli before changing the type.')
      return
    }

    setError('')
    if (type === 'storing') setStoringType(value)
    if (type === 'package') setPackageType(value)
  }

  function selectProduct(productKey) {
    setSelectedProductKey(productKey)
    setSelectedBreakdownId('')
    setProductPickerOpen(false)
    setError('')
  }

  function addToKoli(event) {
    event.preventDefault()

    if (!selectedProduct || !selectedSize) {
      setError('Choose product and size first.')
      return
    }

    const inputQty = Number(qty || 0)
    if (!inputQty) {
      setError('Qty is required.')
      return
    }

    if (inputQty > Number(selectedSize.remaining_qty || 0)) {
      setError('Qty cannot be greater than available size qty.')
      return
    }

    if (draftItems.length && Number(draftItems[0].brand_id || 0) !== Number(selectedProduct.brand_id || 0)) {
      setError('One regular card can only contain one brand. Post or clear this koli first.')
      return
    }

    setDraftItems((prev) => {
      const existingIndex = prev.findIndex((row) => Number(row.breakdown_id || 0) === Number(selectedSize.id || 0))
      if (existingIndex >= 0) {
        return prev.map((row, index) => (
          index === existingIndex ? { ...row, qty: Number(row.qty || 0) + inputQty } : row
        ))
      }

      return [
        ...prev,
        {
          breakdown_id: selectedSize.id,
          product_key: selectedProduct.key,
          item_name: selectedProduct.item_name,
          brand_id: selectedProduct.brand_id,
          brand_name: selectedProduct.brand_name,
          photo_url: selectedProduct.photo_url,
          size_label: selectedSize.size_label,
          qty: inputQty,
        },
      ]
    })
    setQty('')
    setError('')
    setSuccess('Added to current koli. Post when ready.')
  }

  function removeDraftItem(breakdownId) {
    setDraftItems((prev) => prev.filter((row) => Number(row.breakdown_id || 0) !== Number(breakdownId || 0)))
  }

  function clearDraft() {
    setDraftItems([])
    setSuccess('')
    setError('')
  }

  async function postCurrentKoli() {
    if (!inbound || !draftItems.length || posting) return

    setPosting(true)
    setError('')
    setSuccess('')

    try {
      const latestPackingRows = await reloadPackingRows(inbound.id)
      const latestPackedByTargetKey = latestPackingRows.reduce((result, row) => {
        const key = `${Number(row.pl_size_breakdown_id || 0)}::${normalize(row.storing_type)}`
        result.set(key, (result.get(key) || 0) + Number(row.qty || 0))
        return result
      }, new Map())

      for (const draft of draftItems) {
        const sourceBreakdown = breakdownRows.find((row) => Number(row.id || 0) === Number(draft.breakdown_id || 0))
        const targetKey = `${Number(draft.breakdown_id || 0)}::${storingType}`
        const latestPackedQty = latestPackedByTargetKey.get(targetKey) || 0
        const modelVariantQty = sourceBreakdown
          ? modelVariantQtyByIdentity.get(getAllocationIdentity(sourceBreakdown)) || 0
          : 0
        const targetQty = sourceBreakdown
          ? getStoredOrDefaultTargetQty(sourceBreakdown, modelVariantQty, storingType)
          : 0
        const latestRemainingQty = targetQty - latestPackedQty
        if (!sourceBreakdown || Number(draft.qty || 0) > latestRemainingQty) {
          throw new Error(`${draft.item_name} / ${draft.size_label} exceeds available size qty.`)
        }
      }

      const brandId = Number(draftItems[0]?.brand_id || 0) || null
      const isPhoto = packageType === 'PHOTO'
      const maxSequence = isPhoto
        ? 0
        : latestPackingRows
            .filter((row) =>
              Number(row.inbound_id || 0) === Number(inbound.id || 0) &&
              row.storing_type === storingType &&
              row.package_type === 'REGULAR' &&
              Number(row.brand_id || 0) === Number(brandId || 0)
            )
            .reduce((max, row) => Math.max(max, Number(row.koli_sequence || 0)), 0)
      const nextSequence = isPhoto ? null : maxSequence + 1
      const koliLabel = isPhoto ? '-' : String(nextSequence)
      const now = new Date().toISOString()
      const groupKey = `${inbound.id}-${storingType}-${packageType}-${brandId || 'none'}-${Date.now()}`
      const payload = draftItems.map((draft) => {
        const sourceBreakdown = breakdownRows.find((row) => Number(row.id || 0) === Number(draft.breakdown_id || 0)) || {}
        return {
          inbound_id: inbound.id,
          pl_size_breakdown_id: draft.breakdown_id,
          packing_group_key: groupKey,
          storing_type: storingType,
          package_type: packageType,
          brand_id: brandId,
          product_model_id: sourceBreakdown.product_model_id || null,
          product_model_variant_id: sourceBreakdown.product_model_variant_id || null,
          source_variant_code: sourceBreakdown.source_variant_code || null,
          pl_detail_seq: sourceBreakdown.pl_detail_seq || null,
          detail_order: sourceBreakdown.detail_order || null,
          pl_name: sourceBreakdown.pl_name || null,
          model_name: sourceBreakdown.model_name || null,
          variant_name: sourceBreakdown.variant_name || null,
          size_label: draft.size_label,
          koli_sequence: nextSequence,
          koli_label: koliLabel,
          qty: draft.qty,
          packed_by: displayName,
          posted_at: now,
          updated_at: now,
        }
      })

      const { error: insertError } = await supabase.from('pl_packing_items').insert(payload)
      if (insertError) throw insertError

      await reloadPackingRows(inbound.id)
      setPostedCard({
        storing_type: storingType,
        package_type: packageType,
        brand_name: draftItems[0]?.brand_name || '-',
        koli_label: koliLabel,
        qty: draftItems.reduce((sum, row) => sum + Number(row.qty || 0), 0),
        rows: draftItems,
      })
      setDraftItems([])
      setSuccess(`${packageType === 'PHOTO' ? 'Photo item' : `Koli ${koliLabel}`} posted.`)
    } catch (postError) {
      setError(postError.message || 'Failed to post Item Storing.')
    } finally {
      setPosting(false)
    }
  }

  function handleBack() {
    router.push(`/dashboard/packing-list/size-breakdown?grn=${encodeURIComponent(grnNumber)}`)
  }

  if (loading) {
    return <div style={styles.loadingPage}>Loading Item Storing...</div>
  }

  return (
    <div style={styles.pageShell}>
      <main style={styles.mobileFrame}>
        <header style={styles.topBar}>
          <button type="button" onClick={handleBack} style={styles.backButton} aria-label="Back to size breakdown">
            <ArrowLeftIcon />
          </button>
          <div style={styles.titleBlock}>
            <p style={styles.eyebrow}>Packing List</p>
            <h1 style={styles.title}>Item Storing</h1>
          </div>
          <span style={styles.grnChip}>{grnNumber || '-'}</span>
        </header>

        {!inbound ? (
          <section style={styles.formCard}>
            <p style={styles.errorText}>{error || 'Item Storing is not available.'}</p>
          </section>
        ) : (
          <>
            <section style={styles.formCard}>
              <div style={styles.toggleRow}>
                <div style={styles.storingModeGrid}>
                  {['MOB', 'OI'].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setToggle('storing', item)}
                      style={{ ...styles.storingModeButton, ...(storingType === item ? styles.storingModeButtonActive : {}) }}
                    >
                      <span style={styles.storingModeTitle}>{item}</span>
                    </button>
                  ))}
                </div>
                <div style={styles.segmentedToggle}>
                  {[
                    ['PHOTO', 'Foto'],
                    ['REGULAR', 'Regular'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setToggle('package', value)}
                      style={{ ...styles.segmentedButton, ...(packageType === value ? styles.segmentedButtonActive : {}) }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.productPicker}>
                <span style={styles.label}>Product</span>
                <button
                  type="button"
                  onClick={() => setProductPickerOpen((prev) => !prev)}
                  style={selectedProduct ? styles.productPickerButton : { ...styles.productPickerButton, ...styles.productPickerButtonEmpty }}
                >
                  {selectedProduct?.photo_url ? (
                    <Image src={selectedProduct.photo_url} alt={selectedProduct.item_name} width={44} height={44} unoptimized style={styles.productPickerThumb} />
                  ) : selectedProduct ? (
                    <span style={styles.productPickerNoPhoto}>NO</span>
                  ) : null}
                  <span style={styles.productPickerText}>
                    <strong style={styles.productPickerName}>{selectedProduct?.item_name || 'Choose Item'}</strong>
                    {selectedProduct ? <small style={styles.productPickerBrand}>{selectedProduct.brand_name}</small> : null}
                  </span>
                  <span style={styles.productPickerChevron}>⌄</span>
                </button>
                {productPickerOpen ? (
                  <div style={styles.productPickerMenu}>
                    {products.map((product) => (
                      <button key={product.key} type="button" onClick={() => selectProduct(product.key)} style={styles.productPickerOption}>
                        {product.photo_url ? (
                          <Image src={product.photo_url} alt={product.item_name} width={46} height={46} unoptimized style={styles.productPickerThumb} />
                        ) : (
                          <span style={styles.productPickerNoPhoto}>NO</span>
                        )}
                        <span style={styles.productPickerText}>
                          <strong style={styles.productPickerName}>{product.item_name}</strong>
                          <small style={styles.productPickerBrand}>{product.brand_name}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {selectedProduct ? (
                <div style={styles.selectedProductPreview}>
                  {selectedProduct.photo_url ? (
                    <Image src={selectedProduct.photo_url} alt={selectedProduct.item_name} width={420} height={280} unoptimized style={styles.selectedProductImage} />
                  ) : (
                    <span style={styles.selectedProductNoPhoto}>NO PHOTO</span>
                  )}
                  <div style={styles.selectedProductInfo}>
                    <span style={styles.selectedProductBrand}>{selectedProduct.brand_name}</span>
                    <strong style={styles.selectedProductName}>{selectedProduct.item_name}</strong>
                  </div>
                </div>
              ) : null}

              <form onSubmit={addToKoli} style={styles.inputStack}>
                <label style={styles.field}>
                  <span style={styles.label}>Size</span>
                  <select value={selectedBreakdownId} onChange={(event) => setSelectedBreakdownId(event.target.value)} style={styles.input} disabled={!selectedProduct || !sizeOptions.length}>
                    {sizeOptions.length ? (
                      <>
                        <option value="">Choose size</option>
                        {sizeOptions.map((item) => (
                          <option key={item.id} value={item.id} disabled={item.remaining_qty <= 0}>
                            {item.size_label}
                          </option>
                        ))}
                      </>
                    ) : (
                      <option value="">Choose size</option>
                    )}
                  </select>
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Qty</span>
                  <input
                    value={qty}
                    onChange={(event) => setQty(sanitizeQuantityInput(event.target.value))}
                    onWheel={preventNumberWheel}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    style={styles.input}
                    placeholder="0"
                    disabled={!selectedSize}
                  />
                </label>

                <button type="submit" disabled={!selectedSize} style={!selectedSize ? { ...styles.saveButton, ...styles.buttonDisabled } : styles.saveButton}>
                  Add to Koli
                </button>
              </form>

              {error ? <p style={styles.errorText}>{error}</p> : null}
              {success ? <p style={styles.successText}>{success}</p> : null}
            </section>

            <section style={styles.koliPanel}>
              <div style={styles.sectionHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>Current Koli</h2>
                  <p style={styles.sectionSubtitle}>{currentKoliLabel}</p>
                </div>
                <div style={styles.currentKoliActions}>
                  <button type="button" onClick={postCurrentKoli} disabled={!draftItems.length || posting} style={!draftItems.length || posting ? { ...styles.headerPostButton, ...styles.buttonDisabled } : styles.headerPostButton}>
                    {posting ? 'Posting...' : 'Post'}
                  </button>
                  <button type="button" onClick={clearDraft} disabled={!draftItems.length || posting} style={!draftItems.length || posting ? { ...styles.headerClearButton, ...styles.buttonDisabled } : styles.headerClearButton}>
                    Clear
                  </button>
                </div>
              </div>

              {draftItems.length ? (
                <div style={styles.draftTable}>
                  {draftItems.map((row) => (
                    <div key={row.breakdown_id} style={styles.draftRow}>
                      <button
                        type="button"
                        onClick={() => row.photo_url ? setPreviewPhoto({ src: row.photo_url, alt: row.item_name }) : null}
                        style={styles.draftPhotoButton}
                        aria-label={`Preview ${row.item_name}`}
                      >
                        {row.photo_url ? (
                          <Image src={row.photo_url} alt={row.item_name} width={48} height={48} unoptimized style={styles.draftPhoto} />
                        ) : (
                          <span style={styles.draftNoPhoto}>NO</span>
                        )}
                      </button>
                      <div style={styles.draftInfo}>
                        <span style={styles.draftBrand}>{row.brand_name}</span>
                        <strong style={styles.draftName}>{row.item_name}</strong>
                      </div>
                      <span style={styles.draftSize}>{row.size_label}</span>
                      <span style={styles.draftQty}>{formatNumber(row.qty)}</span>
                      <button type="button" onClick={() => removeDraftItem(row.breakdown_id)} style={styles.removeButton}>X</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={styles.emptyText}>Choose product, size, and qty, then add to koli.</p>
              )}
            </section>

            {postedCard ? (
              <section style={styles.printPreview}>
                <div style={styles.sectionHeader}>
                  <h2 style={styles.sectionTitle}>Print Preview</h2>
                  <button type="button" onClick={() => window.print()} style={styles.printButton}>Print</button>
                </div>
                <div style={styles.printCard}>
                  <p style={styles.printEyebrow}>Packing List Card</p>
                  <h3 style={styles.printTitle}>{postedCard.storing_type} / {postedCard.package_type === 'PHOTO' ? 'FOTO' : `KOLI ${postedCard.koli_label}`}</h3>
                  <p style={styles.printMeta}>{grnNumber} / {postedCard.brand_name} / {formatNumber(postedCard.qty)} pcs</p>
                  {postedCard.rows.map((row) => (
                    <span key={`${row.breakdown_id}-${row.size_label}`} style={styles.koliRow}>
                      {row.item_name} / {row.size_label}: {formatNumber(row.qty)}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

          </>
        )}
      </main>
      {previewPhoto ? (
        <div style={styles.previewOverlay} onClick={() => setPreviewPhoto(null)}>
          <div style={styles.previewFrame} onClick={(event) => event.stopPropagation()}>
            <Image src={previewPhoto.src} alt={previewPhoto.alt || 'Photo preview'} width={900} height={900} unoptimized style={styles.previewImage} />
            <button type="button" onClick={() => setPreviewPhoto(null)} style={styles.previewClose} aria-label="Close photo preview">
              X
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const styles = {
  pageShell: {
    minHeight: '100dvh',
    background: '#f6f7f9',
    display: 'flex',
    justifyContent: 'center',
  },
  loadingPage: {
    minHeight: '70vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#475569',
    fontWeight: 800,
  },
  mobileFrame: {
    width: '100%',
    maxWidth: '520px',
    minHeight: '100dvh',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    paddingBottom: '24px',
  },
  topBar: {
    minHeight: '80px',
    padding: '16px',
    borderBottom: '1px solid #e2e8f0',
    display: 'grid',
    gridTemplateColumns: '44px minmax(0, 1fr) auto',
    gap: '12px',
    alignItems: 'center',
    background: '#fff',
    position: 'sticky',
    top: 0,
    zIndex: 4,
  },
  backButton: {
    width: '44px',
    height: '44px',
    border: '1px solid #cbd5e1',
    borderRadius: '14px',
    background: '#fff',
    color: '#0f172a',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  titleBlock: {
    minWidth: 0,
  },
  eyebrow: {
    margin: 0,
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 900,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  title: {
    margin: '2px 0 0',
    color: '#0f172a',
    fontSize: '24px',
    lineHeight: 1.05,
    fontWeight: 950,
  },
  grnChip: {
    minHeight: '34px',
    padding: '0 10px',
    borderRadius: '999px',
    background: '#f1f5f9',
    color: '#0f172a',
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '12px',
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },
  summaryBand: {
    margin: '0 16px',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '8px',
  },
  summaryItem: {
    minHeight: '72px',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    background: '#f8fafc',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '4px',
  },
  summaryLabel: {
    color: '#64748b',
    fontSize: '10px',
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: '#0f172a',
    fontSize: '20px',
    lineHeight: 1,
    fontWeight: 950,
    fontVariantNumeric: 'tabular-nums',
  },
  formCard: {
    margin: '0 16px',
    border: '1px solid #e2e8f0',
    borderRadius: '20px',
    background: '#fff',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    flexWrap: 'wrap',
  },
  storingModeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '8px',
    flex: '1 1 210px',
  },
  storingModeButton: {
    minHeight: '44px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    borderRadius: '16px',
    background: '#fff',
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  storingModeButtonActive: {
    background: '#0f172a',
    borderColor: '#0f172a',
    color: '#fff',
    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.16)',
  },
  storingModeTitle: {
    fontSize: '15px',
    lineHeight: 1,
    fontWeight: 950,
  },
  storingModeText: {
    fontSize: '10px',
    lineHeight: 1.2,
    fontWeight: 800,
    opacity: 0.76,
  },
  segmentedToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px',
    borderRadius: '999px',
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
  },
  segmentedButton: {
    minHeight: '30px',
    padding: '0 12px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: '999px',
    background: 'transparent',
    color: '#64748b',
    fontSize: '12px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  segmentedButtonActive: {
    background: '#fff',
    color: '#0f172a',
    borderColor: '#cbd5e1',
    boxShadow: '0 6px 14px rgba(15, 23, 42, 0.08)',
  },
  productPicker: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
  },
  productPickerButton: {
    width: '100%',
    minHeight: '58px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    borderRadius: '16px',
    background: '#fff',
    padding: '7px 10px',
    display: 'grid',
    gridTemplateColumns: '44px minmax(0, 1fr) 20px',
    gap: '10px',
    alignItems: 'center',
    cursor: 'pointer',
    textAlign: 'left',
  },
  productPickerButtonEmpty: {
    gridTemplateColumns: 'minmax(0, 1fr) 20px',
    minHeight: '50px',
    padding: '0 14px',
  },
  productPickerMenu: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    zIndex: 20,
    maxHeight: '280px',
    overflowY: 'auto',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: '16px',
    background: '#fff',
    padding: '6px',
    boxShadow: '0 18px 34px rgba(15, 23, 42, 0.16)',
  },
  productPickerOption: {
    width: '100%',
    minHeight: '56px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: '12px',
    background: '#fff',
    padding: '6px',
    display: 'grid',
    gridTemplateColumns: '46px minmax(0, 1fr)',
    gap: '10px',
    alignItems: 'center',
    cursor: 'pointer',
    textAlign: 'left',
  },
  productPickerThumb: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    objectFit: 'cover',
    background: '#f1f5f9',
  },
  productPickerNoPhoto: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: '#f1f5f9',
    color: '#94a3b8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 950,
  },
  productPickerText: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  productPickerName: {
    color: '#0f172a',
    fontSize: '13px',
    lineHeight: 1.25,
    fontWeight: 950,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  productPickerBrand: {
    color: '#64748b',
    fontSize: '11px',
    lineHeight: 1.2,
    fontWeight: 800,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  productPickerChevron: {
    color: '#64748b',
    fontSize: '18px',
    fontWeight: 950,
  },
  selectedProductPreview: {
    border: '1px solid #e2e8f0',
    borderRadius: '18px',
    overflow: 'hidden',
    background: '#f8fafc',
  },
  selectedProductImage: {
    width: '100%',
    height: '220px',
    objectFit: 'cover',
    background: '#f1f5f9',
  },
  selectedProductNoPhoto: {
    width: '100%',
    height: '220px',
    background: '#f1f5f9',
    color: '#94a3b8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 950,
  },
  selectedProductInfo: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    color: '#0f172a',
  },
  selectedProductBrand: {
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  selectedProductName: {
    color: '#0f172a',
    fontSize: '16px',
    lineHeight: 1.25,
    fontWeight: 950,
  },
  inputStack: {
    display: 'grid',
    gridTemplateColumns: '1fr 96px',
    gap: '10px',
    alignItems: 'end',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
  },
  label: {
    color: '#334155',
    fontSize: '12px',
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  input: {
    width: '100%',
    height: '46px',
    border: '1px solid #cbd5e1',
    borderRadius: '14px',
    background: '#fff',
    color: '#0f172a',
    padding: '0 12px',
    fontSize: '15px',
    fontWeight: 750,
    boxSizing: 'border-box',
  },
  saveButton: {
    gridColumn: '1 / -1',
    width: '100%',
    minHeight: '48px',
    border: 'none',
    borderRadius: '16px',
    background: '#0f766e',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 950,
    cursor: 'pointer',
  },
  postButton: {
    width: '100%',
    minHeight: '48px',
    border: 'none',
    borderRadius: '16px',
    background: '#0f172a',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 950,
    cursor: 'pointer',
  },
  buttonDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  errorText: {
    margin: 0,
    color: '#dc2626',
    fontSize: '13px',
    fontWeight: 800,
  },
  successText: {
    margin: 0,
    color: '#047857',
    fontSize: '13px',
    fontWeight: 800,
  },
  koliPanel: {
    margin: '0 16px',
    border: '1px solid #e2e8f0',
    borderRadius: '20px',
    background: '#fff',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  sectionTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '18px',
    fontWeight: 950,
  },
  sectionSubtitle: {
    margin: '3px 0 0',
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 800,
  },
  currentKoliActions: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  headerPostButton: {
    minHeight: '42px',
    minWidth: '76px',
    border: 'none',
    borderRadius: '14px',
    background: '#0f172a',
    color: '#fff',
    padding: '0 14px',
    fontSize: '14px',
    fontWeight: 950,
    cursor: 'pointer',
  },
  headerClearButton: {
    minHeight: '42px',
    minWidth: '76px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#fecaca',
    borderRadius: '14px',
    background: '#fff',
    color: '#dc2626',
    padding: '0 14px',
    fontSize: '14px',
    fontWeight: 950,
    cursor: 'pointer',
  },
  sectionPill: {
    minHeight: '28px',
    padding: '0 10px',
    borderRadius: '999px',
    background: '#f1f5f9',
    color: '#475569',
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '12px',
    fontWeight: 900,
  },
  koliList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  draftTable: {
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: '16px',
    overflow: 'hidden',
    background: '#fff',
  },
  draftRow: {
    display: 'grid',
    gridTemplateColumns: '48px minmax(0, 1fr) 52px 44px 32px',
    gap: '8px',
    alignItems: 'center',
    padding: '9px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#f1f5f9',
  },
  draftPhotoButton: {
    width: '48px',
    height: '48px',
    border: 'none',
    borderRadius: '12px',
    background: '#f1f5f9',
    padding: 0,
    overflow: 'hidden',
    cursor: 'pointer',
  },
  draftPhoto: {
    width: '48px',
    height: '48px',
    objectFit: 'cover',
    display: 'block',
  },
  draftNoPhoto: {
    width: '48px',
    height: '48px',
    color: '#94a3b8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 950,
  },
  draftInfo: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  draftBrand: {
    color: '#64748b',
    fontSize: '10px',
    fontWeight: 900,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  draftName: {
    color: '#0f172a',
    fontSize: '12px',
    lineHeight: 1.25,
    fontWeight: 950,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  draftSize: {
    color: '#0f172a',
    fontSize: '12px',
    fontWeight: 950,
    textAlign: 'center',
  },
  draftQty: {
    color: '#0f172a',
    fontSize: '13px',
    fontWeight: 950,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
  koliCard: {
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    background: '#f8fafc',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  koliHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    color: '#0f172a',
    fontSize: '14px',
    fontWeight: 950,
  },
  koliRows: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  koliRow: {
    color: '#475569',
    fontSize: '12px',
    lineHeight: 1.35,
    fontWeight: 750,
  },
  removeButton: {
    width: '30px',
    height: '30px',
    border: '1px solid #fecaca',
    borderRadius: '999px',
    background: '#fff',
    color: '#dc2626',
    fontSize: '12px',
    fontWeight: 950,
    cursor: 'pointer',
  },
  printPreview: {
    margin: '0 16px',
    border: '1px solid #cbd5e1',
    borderRadius: '20px',
    background: '#f8fafc',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  printButton: {
    minHeight: '30px',
    border: '1px solid #cbd5e1',
    borderRadius: '999px',
    background: '#fff',
    color: '#0f172a',
    padding: '0 10px',
    fontSize: '12px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  printCard: {
    border: '1px dashed #94a3b8',
    borderRadius: '16px',
    background: '#fff',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  printEyebrow: {
    margin: 0,
    color: '#64748b',
    fontSize: '10px',
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  printTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '22px',
    fontWeight: 950,
  },
  printMeta: {
    margin: 0,
    color: '#334155',
    fontSize: '13px',
    fontWeight: 850,
  },
  emptyText: {
    margin: 0,
    color: '#64748b',
    fontSize: '13px',
    fontWeight: 750,
  },
  previewOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 60,
    background: 'rgba(15, 23, 42, 0.72)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '18px',
  },
  previewFrame: {
    position: 'relative',
    width: 'min(92vw, 720px)',
    maxHeight: '86vh',
    borderRadius: '18px',
    overflow: 'hidden',
    background: '#020617',
  },
  previewImage: {
    width: '100%',
    height: 'auto',
    maxHeight: '86vh',
    objectFit: 'contain',
    display: 'block',
  },
  previewClose: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    width: '34px',
    height: '34px',
    border: 'none',
    borderRadius: '999px',
    background: '#fff',
    color: '#dc2626',
    fontSize: '14px',
    fontWeight: 950,
    cursor: 'pointer',
  },
}
