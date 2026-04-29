'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'

const supabase = createClient()

function formatDateDisplay(value) {
  if (!value) return '-'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function buildCategoryMaps(categories) {
  const byId = new Map(categories.map((item) => [item.id, item]))
  const rootOptions = []
  const childMap = new Map()

  for (const category of categories) {
    if (!category.parent_id) {
      rootOptions.push(category)
      continue
    }

    if (!childMap.has(category.parent_id)) {
      childMap.set(category.parent_id, [])
    }

    childMap.get(category.parent_id).push(category)
  }

  const sortByCode = (items) =>
    [...items].sort((a, b) =>
      (a.full_code || a.category_code || '').localeCompare(b.full_code || b.category_code || '')
    )

  return {
    byId,
    roots: sortByCode(rootOptions),
    getChildren(parentId) {
      return sortByCode(childMap.get(parentId) || [])
    },
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Failed to read image file.'))
    reader.readAsDataURL(file)
  })
}

function normalizeText(value) {
  return String(value || '').trim().toUpperCase()
}

function getModelDisplayLabel(modelName, modelColor, variantLabel) {
  const baseLabel = modelColor ? `${modelName} / ${modelColor}` : modelName || '-'
  return variantLabel ? `${baseLabel} | Product ID ${variantLabel}` : baseLabel
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontSize: '28px',
  },
  subtitle: {
    margin: '6px 0 0',
    color: '#6b7280',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
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
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  inlineRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  modelPickerCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: '16px',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    background: '#f9fafb',
  },
  modelGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '12px',
  },
  modelOptionCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid #d1d5db',
    background: '#fff',
    cursor: 'pointer',
    textAlign: 'left',
  },
  modelOptionTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#111827',
  },
  modelOptionMeta: {
    fontSize: '12px',
    color: '#6b7280',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#111827',
  },
  helperText: {
    fontSize: '12px',
    color: '#6b7280',
  },
  input: {
    height: '42px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    width: '100%',
  },
  select: {
    height: '42px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    background: '#fff',
    width: '100%',
  },
  textarea: {
    minHeight: '96px',
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    resize: 'vertical',
  },
  readonlyBox: {
    minHeight: '42px',
    padding: '10px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    background: '#f9fafb',
    fontSize: '14px',
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  },
  iconButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '42px',
    minWidth: '42px',
    height: '42px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#fff',
    color: '#111827',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    gap: '16px',
  },
  headerSummaryGrid: {
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
    gap: '8px',
  },
  summaryLabel: {
    fontSize: '13px',
    color: '#6b7280',
    fontWeight: '600',
  },
  summaryLabelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  tooltipWrap: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
  },
  tooltipButton: {
    width: '18px',
    height: '18px',
    borderRadius: '999px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#475569',
    fontSize: '11px',
    fontWeight: '700',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'help',
    padding: 0,
  },
  tooltipBox: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    left: 0,
    minWidth: '240px',
    maxWidth: '280px',
    padding: '10px 12px',
    borderRadius: '10px',
    background: '#111827',
    color: '#fff',
    fontSize: '12px',
    lineHeight: 1.5,
    boxShadow: '0 12px 28px rgba(0, 0, 0, 0.18)',
    zIndex: 10,
    opacity: 0,
    visibility: 'hidden',
    transform: 'translateY(-4px)',
    transition: 'opacity 0.18s ease, transform 0.18s ease, visibility 0.18s ease',
  },
  summaryValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#111827',
  },
  checkboxWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '600',
  },
  toggleWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '600',
  },
  toggleButton: {
    padding: 0,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
  },
  toggleTrack: {
    width: '48px',
    height: '28px',
    borderRadius: '999px',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    transition: 'background-color 0.2s ease',
  },
  toggleThumb: {
    width: '20px',
    height: '20px',
    borderRadius: '999px',
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
    transition: 'transform 0.2s ease',
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    flexWrap: 'wrap',
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
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '12px 14px',
    textAlign: 'left',
    background: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '13px',
    fontWeight: '700',
    color: '#374151',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '12px 14px',
    borderTop: '1px solid #f1f5f9',
    fontSize: '14px',
    color: '#111827',
    verticalAlign: 'top',
  },
  sampleBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '78px',
    height: '28px',
    padding: '0 10px',
    borderRadius: '999px',
    background: '#fef3c7',
    color: '#92400e',
    fontSize: '12px',
    fontWeight: '700',
  },
  returnBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '78px',
    height: '28px',
    padding: '0 10px',
    borderRadius: '999px',
    background: '#fee2e2',
    color: '#b91c1c',
    fontSize: '12px',
    fontWeight: '700',
  },
  koliCell: {
    textAlign: 'center',
    verticalAlign: 'middle',
  },
  koliHeader: {
    textAlign: 'center',
  },
  emptyText: {
    margin: 0,
    color: '#6b7280',
  },
  errorText: {
    margin: 0,
    color: '#dc2626',
  },
  successText: {
    margin: 0,
    color: '#16a34a',
  },
  middleCell: {
    verticalAlign: 'middle',
  },
  summaryImageButton: {
    padding: 0,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    display: 'inline-flex',
  },
  actionInline: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  printButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '32px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#fff',
    color: '#111827',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17, 24, 39, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    zIndex: 40,
  },
  modal: {
    width: '100%',
    maxWidth: '560px',
    background: '#fff',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  imagePreview: {
    width: '96px',
    height: '96px',
    borderRadius: '12px',
    objectFit: 'cover',
    border: '1px solid #e5e7eb',
  },
  modelThumb: {
    width: '100%',
    height: '120px',
    borderRadius: '10px',
    objectFit: 'cover',
    border: '1px solid #e5e7eb',
    background: '#fff',
  },
  summaryThumb: {
    width: '72px',
    height: '72px',
    borderRadius: '10px',
    objectFit: 'cover',
    border: '1px solid #e5e7eb',
    background: '#fff',
  },
  summaryThumbEmpty: {
    width: '72px',
    height: '72px',
    borderRadius: '10px',
    border: '1px solid #e5e7eb',
    background: '#f9fafb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#9ca3af',
    fontSize: '11px',
    fontWeight: '700',
  },
}

export default function UnloadPage() {
  const [inbounds, setInbounds] = useState([])
  const [brands, setBrands] = useState([])
  const [categories, setCategories] = useState([])
  const [productModels, setProductModels] = useState([])
  const [productModelVariants, setProductModelVariants] = useState([])
  const [selectedInboundId, setSelectedInboundId] = useState('')
  const [roSearch, setRoSearch] = useState('')
  const [brandSearch, setBrandSearch] = useState('')
  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [level0Id, setLevel0Id] = useState('')
  const [level1Id, setLevel1Id] = useState('')
  const [level2Id, setLevel2Id] = useState('')
  const [selectedModel, setSelectedModel] = useState(null)
  const [selectedVariantLabel, setSelectedVariantLabel] = useState('')
  const [qty, setQty] = useState('')
  const [picName, setPicName] = useState('')
  const [isSample, setIsSample] = useState(false)
  const [isReturn, setIsReturn] = useState(false)
  const [currentKoliItems, setCurrentKoliItems] = useState([])
  const [unloadRows, setUnloadRows] = useState([])
  const [returnRows, setReturnRows] = useState([])
  const [showChooseModelModal, setShowChooseModelModal] = useState(false)
  const [showModelModal, setShowModelModal] = useState(false)
  const [modelDraft, setModelDraft] = useState({
    model_name: '',
    model_color: '',
    photo_url: '',
  })
  const [modelPhotoFile, setModelPhotoFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [modelModalError, setModelModalError] = useState('')
  const [previewImage, setPreviewImage] = useState(null)
  const [showProcessedTooltip, setShowProcessedTooltip] = useState(false)
  const [supportsUnloadVariant, setSupportsUnloadVariant] = useState(false)
  const [supportsReturnVariant, setSupportsReturnVariant] = useState(false)

  useEffect(() => {
    async function loadInitialData() {
      setLoading(true)
      setError('')

      const [
        { data: inboundRows, error: inboundError },
        { data: brandRows, error: brandError },
        { data: categoryRows, error: categoryError },
        { data: modelRows, error: modelError },
        { data: productVariantRows, error: productVariantError },
      ] = await Promise.all([
        supabase
          .from('inbound')
          .select('id, grn_number, total_claimed_qty, total_received_qty, inbound_date, item_name, suppliers:dir_suppliers!supplier_id (supplier_name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('dir_brands')
          .select('id, brand_code, brand_name')
          .eq('is_active', true)
          .order('brand_name', { ascending: true }),
        supabase
          .from('dir_categories')
          .select('id, category_code, category_name, parent_id, level, full_code, full_name')
          .eq('is_active', true)
          .order('full_code', { ascending: true }),
        supabase
          .from('dir_product_models')
          .select('id, brand_id, category_id, model_name, model_color, photo_url')
          .eq('is_active', true)
          .order('model_name', { ascending: true }),
        supabase
          .from('dir_product_model_variants')
          .select('*')
          .eq('is_active', true)
          .order('variant_label', { ascending: true }),
      ])

      if (inboundError || brandError || categoryError || modelError || productVariantError) {
        setError(
          inboundError?.message ||
            brandError?.message ||
            categoryError?.message ||
            modelError?.message ||
            productVariantError?.message ||
            'Failed to load unload setup.'
        )
        setLoading(false)
        return
      }

      setInbounds(inboundRows || [])
      setBrands(brandRows || [])
      setCategories(categoryRows || [])
      setProductModels(modelRows || [])
      setProductModelVariants(productVariantRows || [])

      const [{ error: unloadVariantError }, { error: returnVariantError }] = await Promise.all([
        supabase.from('inbound_unload').select('variant_label').limit(1),
        supabase.from('warehouse_returns').select('variant_label').limit(1),
      ])

      setSupportsUnloadVariant(!unloadVariantError)
      setSupportsReturnVariant(!returnVariantError)
      setLoading(false)
    }

    loadInitialData()
  }, [])

  useEffect(() => {
    async function loadUnloadRows() {
      if (!selectedInboundId) {
        setUnloadRows([])
        setReturnRows([])
        setCurrentKoliItems([])
        return
      }

      const [
        { data: unloadData, error: unloadError },
        { data: returnsData, error: returnsError },
      ] = await Promise.all([
        supabase
          .from('inbound_unload')
          .select(
            supportsUnloadVariant
              ? 'id, inbound_id, brand_id, category_id, model_name, model_color, qty, pic_name, is_sample, koli_sequence, photo_url, variant_label'
              : 'id, inbound_id, brand_id, category_id, model_name, model_color, qty, pic_name, is_sample, koli_sequence, photo_url'
          )
          .eq('inbound_id', selectedInboundId)
          .order('is_sample', { ascending: true })
          .order('koli_sequence', { ascending: true })
          .order('id', { ascending: true }),
        supabase
          .from('warehouse_returns')
          .select(
            supportsReturnVariant
              ? 'id, inbound_id, source_phase, brand_id, category_id, model_name, model_color, qty, pic_name, created_at, variant_label'
              : 'id, inbound_id, source_phase, brand_id, category_id, model_name, model_color, qty, pic_name, created_at'
          )
          .eq('inbound_id', selectedInboundId)
          .eq('source_phase', 'inbound')
          .order('created_at', { ascending: true }),
      ])

      if (unloadError || returnsError) {
        setError(unloadError?.message || returnsError?.message || 'Failed to load unload rows.')
        return
      }

      setUnloadRows(unloadData || [])
      setReturnRows(returnsData || [])
    }

    loadUnloadRows()
  }, [selectedInboundId, supportsReturnVariant, supportsUnloadVariant])

  const categoryMaps = buildCategoryMaps(categories)
  const level0Options = categoryMaps.roots
  const level1Options = level0Id ? categoryMaps.getChildren(Number(level0Id)) : []
  const level2Options = level1Id ? categoryMaps.getChildren(Number(level1Id)) : []
  const requiresLevel1 = level1Options.length > 0
  const requiresLevel2 = level2Options.length > 0

  const selectedInbound =
    inbounds.find((item) => item.id === Number(selectedInboundId)) || null

  const selectedCategoryId =
    requiresLevel1 && !level1Id
      ? ''
      : requiresLevel2 && !level2Id
        ? ''
        : level2Id || level1Id || level0Id || ''
  const selectedCategory = selectedCategoryId
    ? categoryMaps.byId.get(Number(selectedCategoryId)) || null
    : null

  const filteredModelOptions = productModels
    .filter((item) => {
      if (!selectedBrandId || !selectedCategory) return false

      return (
        Number(item.brand_id || 0) === Number(selectedBrandId) &&
        Number(item.category_id || 0) === Number(selectedCategory.id)
      )
    })
    .sort((a, b) => {
      const aLabel = a.model_color ? `${a.model_name} ${a.model_color}` : a.model_name
      const bLabel = b.model_color ? `${b.model_name} ${b.model_color}` : b.model_name
      return aLabel.localeCompare(bLabel)
    })

  const selectedModelVariants = useMemo(
    () =>
      productModelVariants
        .filter((item) => Number(item.product_model_id || 0) === Number(selectedModel?.id || 0))
        .sort((a, b) => Number(a.variant_index ?? 0) - Number(b.variant_index ?? 0)),
    [productModelVariants, selectedModel]
  )

  const nextKoliSequence =
    unloadRows.filter((row) => !row.is_sample).reduce(
      (max, row) => Math.max(max, Number(row.koli_sequence || 0)),
      0
    ) + 1
  const totalKoli = new Set(unloadRows.filter((row) => !row.is_sample).map((row) => Number(row.koli_sequence || 0))).size
  const totalSampleQty = unloadRows
    .filter((row) => row.is_sample)
    .reduce((sum, row) => sum + Number(row.qty || 0), 0)
  const totalProcessedQty = unloadRows.reduce((sum, row) => sum + Number(row.qty || 0), 0)
  const totalReturnQty = returnRows
    .reduce((sum, row) => sum + Number(row.qty || 0), 0)
  const totalInboundQty =
    unloadRows.reduce((sum, row) => sum + Number(row.qty || 0), 0) + totalReturnQty
  const resultRows = [
    ...unloadRows.map((row) => ({ ...row, rowType: row.is_sample ? 'sample' : 'koli' })),
    ...returnRows.map((row) => ({ ...row, rowType: 'return', is_sample: false, koli_sequence: null })),
  ]
  const koliGroups = useMemo(() => {
    const grouped = new Map()

    unloadRows
      .filter((row) => !row.is_sample && row.koli_sequence != null)
      .forEach((row) => {
        const key = Number(row.koli_sequence)
        const current = grouped.get(key) || {
          koli_sequence: key,
          items: [],
          total_qty: 0,
          pic_names: new Set(),
        }

        current.items.push(row)
        current.total_qty += Number(row.qty || 0)
        if (row.pic_name) {
          current.pic_names.add(row.pic_name)
        }
        grouped.set(key, current)
      })

    return Array.from(grouped.values())
      .sort((a, b) => a.koli_sequence - b.koli_sequence)
      .map((group) => ({
        ...group,
        pic_list: Array.from(group.pic_names),
      }))
  }, [unloadRows])
  const summaryMap = new Map()

  function getDefaultVariantLabelForModel(model) {
    if (!model) return ''

    const variantRows = productModelVariants
      .filter((item) => Number(item.product_model_id || 0) === Number(model.id || 0))
      .sort((a, b) => Number(a.variant_index ?? 0) - Number(b.variant_index ?? 0))

    const mainVariant =
      variantRows.find((item) => item.is_main_variant) ||
      variantRows.find((item) => Number(item.variant_index ?? 0) === 0) ||
      variantRows[0] ||
      null

    return mainVariant?.variant_label || ''
  }

  for (const row of unloadRows) {
    const label = getModelDisplayLabel(row.model_name, row.model_color, row.variant_label)

    if (!summaryMap.has(label)) {
      summaryMap.set(label, {
        modelLabel: label,
        modelQty: 0,
        photoUrl: row.photo_url || '',
      })
    }

    const currentValue = summaryMap.get(label)
    currentValue.modelQty += Number(row.qty || 0)

    if (!currentValue.photoUrl && row.photo_url) {
      currentValue.photoUrl = row.photo_url
    }
  }

  const summaryRows = [...summaryMap.values()]

  function handleRoSearchChange(value) {
    setRoSearch(value)
    const match = inbounds.find((item) => item.grn_number === value)
    setSelectedInboundId(match ? String(match.id) : '')
    setCurrentKoliItems([])
    setSuccess('')
  }

  function handleBrandSearchChange(value) {
    setBrandSearch(value)
    const normalizedValue = normalizeText(value)
    const match = brands.find((item) => {
      const optionLabel = `${item.brand_name}${item.brand_code ? ` (${item.brand_code})` : ''}`
      return (
        normalizeText(optionLabel) === normalizedValue ||
        normalizeText(item.brand_name) === normalizedValue ||
        normalizeText(item.brand_code) === normalizedValue
      )
    })
    setSelectedBrandId(match ? String(match.id) : '')
    setSelectedModel(null)
    setSelectedVariantLabel('')
  }

  async function handleModelPhotoChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setModelPhotoFile(file)
      const dataUrl = await readFileAsDataUrl(file)
      setModelDraft((prev) => ({
        ...prev,
        photo_url: dataUrl,
      }))
    } catch (photoError) {
      setModelModalError(photoError.message)
    }
  }

  function resetAddForm({ keepPicName = false } = {}) {
    setBrandSearch('')
    setSelectedBrandId('')
    setLevel0Id('')
    setLevel1Id('')
    setLevel2Id('')
    setSelectedModel(null)
    setSelectedVariantLabel('')
    setQty('')
    if (!keepPicName) {
      setPicName('')
    }
    setIsSample(false)
    setIsReturn(false)
  }

  async function refreshUnloadData(inboundId) {
    const [
      { data: refreshedUnloadRows, error: refreshUnloadError },
      { data: refreshedReturnRows, error: refreshReturnError },
    ] = await Promise.all([
      supabase
        .from('inbound_unload')
        .select(
          supportsUnloadVariant
            ? 'id, inbound_id, brand_id, category_id, model_name, model_color, qty, pic_name, is_sample, koli_sequence, photo_url, variant_label'
            : 'id, inbound_id, brand_id, category_id, model_name, model_color, qty, pic_name, is_sample, koli_sequence, photo_url'
        )
        .eq('inbound_id', inboundId)
        .order('is_sample', { ascending: true })
        .order('koli_sequence', { ascending: true })
        .order('id', { ascending: true }),
      supabase
        .from('warehouse_returns')
        .select(
          supportsReturnVariant
            ? 'id, inbound_id, source_phase, brand_id, category_id, model_name, model_color, qty, pic_name, created_at, variant_label'
            : 'id, inbound_id, source_phase, brand_id, category_id, model_name, model_color, qty, pic_name, created_at'
        )
        .eq('inbound_id', inboundId)
        .eq('source_phase', 'inbound')
        .order('created_at', { ascending: true }),
    ])

    if (refreshUnloadError || refreshReturnError) {
      throw new Error(refreshUnloadError?.message || refreshReturnError?.message || 'Failed to refresh unload rows.')
    }

    setUnloadRows(refreshedUnloadRows || [])
    setReturnRows(refreshedReturnRows || [])
  }

  function openImagePreview({ src, title }) {
    if (!src) return
    setPreviewImage({ src, title })
  }

  function closeImagePreview() {
    setPreviewImage(null)
  }

  function handlePrintKoli(koliGroup) {
    if (!selectedInbound || !koliGroup) {
      return
    }

    const printWindow = window.open('', '_blank', 'width=720,height=820')

    if (!printWindow) {
      setError('Print window was blocked by the browser.')
      return
    }

    const rowsHtml = koliGroup.items
      .map((row) => {
        const brand = brands.find((item) => item.id === row.brand_id)
        const modelLabel = getModelDisplayLabel(row.model_name, row.model_color, row.variant_label)

        return `
          <tr>
            <td>${brand?.brand_name || '-'}</td>
            <td>${modelLabel || '-'}</td>
            <td class="qty">${row.qty || 0}</td>
          </tr>
        `
      })
      .join('')

    const printHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Inbound Card</title>
    <style>
      @page { size: A6 portrait; margin: 8mm; }
      body { font-family: Arial, sans-serif; color: #111827; margin: 0; }
      .card { border: 2px solid #111827; border-radius: 16px; padding: 18px; width: 100%; box-sizing: border-box; }
      h1 { margin: 0 0 16px; font-size: 26px; text-align: center; }
      .row { display: grid; grid-template-columns: 88px 1fr; gap: 10px; padding: 8px 0; border-bottom: 1px solid #e5e7eb; align-items: start; }
      .row:last-child { border-bottom: none; }
      .label { font-weight: 700; font-size: 12px; }
      .value { font-weight: 500; font-size: 13px; }
      table { width: 100%; border-collapse: collapse; margin: 18px 0; }
      th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; vertical-align: middle; }
      th { background: #f9fafb; text-align: left; }
      .qty { text-align: center; font-weight: 800; }
      .qtyBox {
        margin: 18px 0;
        padding: 16px;
        border-radius: 16px;
        border: 2px solid #111827;
        text-align: center;
      }
      .qtyLabel {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .qtyValue {
        margin-top: 6px;
        font-size: 54px;
        line-height: 1;
        font-weight: 800;
      }
      .picRow .label, .picRow .value {
        font-size: 11px;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Inbound Card</h1>
      <div class="row"><div class="label">No GRN</div><div class="value">${selectedInbound.grn_number || '-'}</div></div>
      <div class="row"><div class="label">No Koli</div><div class="value">Koli ${koliGroup.koli_sequence || '-'}</div></div>
      <table>
        <thead>
          <tr>
            <th>Brand</th>
            <th>Model Name</th>
            <th>Qty</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <div class="qtyBox">
        <div class="qtyLabel">Total Qty</div>
        <div class="qtyValue">${koliGroup.total_qty || 0}</div>
      </div>
      <div class="row picRow"><div class="label">PIC</div><div class="value">${koliGroup.pic_list.join(', ') || '-'}</div></div>
    </div>
    <script>window.onload = function () { window.print(); };</script>
  </body>
</html>`

    printWindow.document.open()
    printWindow.document.write(printHtml)
    printWindow.document.close()
  }

  function handlePrintUnloadDocument() {
    if (!selectedInbound) {
      setError('Please choose a GRN number first.')
      return
    }

    if (resultRows.length === 0) {
      setError('No unload rows available to print yet.')
      return
    }

    const printWindow = window.open('', '_blank', 'width=900,height=1200')

    if (!printWindow) {
      setError('Print window was blocked by the browser.')
      return
    }

    const supplierName = selectedInbound.suppliers?.supplier_name || '-'
    const uniqueBrands = [...new Set(
      [...unloadRows, ...returnRows]
        .map((row) => brands.find((item) => item.id === row.brand_id)?.brand_name)
        .filter(Boolean)
    )]
    const uniqueCategories = [...new Set(
      [...unloadRows, ...returnRows]
        .map((row) => categoryMaps.byId.get(row.category_id)?.full_name || categoryMaps.byId.get(row.category_id)?.category_name)
        .filter(Boolean)
    )]

    const summaryRowsHtml = summaryRows
      .map(
        (row) => `
          <tr>
            <td class="photoCell">
              ${row.photoUrl ? `<img src="${row.photoUrl}" alt="${row.modelLabel}" class="modelPhoto" />` : '<div class="photoPlaceholder">NO PHOTO</div>'}
            </td>
            <td>${row.modelLabel}</td>
            <td class="qty">${row.modelQty}</td>
          </tr>`
      )
      .join('')

    const printHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Inbound Report</title>
    <style>
      @page { size: A4 portrait; margin: 12mm; }
      body { font-family: Arial, sans-serif; color: #111827; margin: 0; }
      .sheet { width: 100%; box-sizing: border-box; }
      h1 { margin: 0 0 20px; font-size: 28px; }
      .meta {
        display: grid;
        grid-template-columns: 180px 1fr;
        gap: 8px 14px;
        margin-bottom: 24px;
        align-items: center;
      }
      .label {
        font-weight: 700;
        font-size: 13px;
      }
      .value {
        font-size: 13px;
      }
      .summary {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        margin: 24px 0;
        align-items: stretch;
      }
      .summaryCard {
        border: 1px solid #d1d5db;
        border-radius: 12px;
        padding: 14px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .summaryLabel {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        color: #6b7280;
      }
      .summaryValue {
        margin-top: 6px;
        font-size: 28px;
        font-weight: 800;
      }
      h2 {
        margin: 28px 0 12px;
        font-size: 20px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        border: 1px solid #d1d5db;
        padding: 10px 12px;
        text-align: left;
        font-size: 13px;
        vertical-align: middle;
      }
      th {
        background: #f9fafb;
        font-weight: 700;
      }
      .qty {
        width: 120px;
        text-align: right;
        font-weight: 700;
      }
      .photoCell {
        width: 90px;
        text-align: center;
      }
      .modelPhoto {
        width: 64px;
        height: 64px;
        object-fit: cover;
        border-radius: 8px;
        border: 1px solid #d1d5db;
        display: block;
      }
      .photoPlaceholder {
        width: 64px;
        height: 64px;
        border-radius: 8px;
        border: 1px solid #d1d5db;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 700;
        color: #9ca3af;
        background: #f9fafb;
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <h1>Inbound Report</h1>

      <div class="meta">
        <div class="label">No GRN</div><div class="value">${selectedInbound.grn_number || '-'}</div>
        <div class="label">Supplier</div><div class="value">${supplierName}</div>
        <div class="label">Merek</div><div class="value">${uniqueBrands.length ? uniqueBrands.join(', ') : '-'}</div>
        <div class="label">Categories Name</div><div class="value">${uniqueCategories.length ? uniqueCategories.join(', ') : '-'}</div>
      </div>

      <div class="summary">
        <div class="summaryCard">
          <div class="summaryLabel">Total SJ</div>
          <div class="summaryValue">${selectedInbound.total_claimed_qty || 0}</div>
        </div>
        <div class="summaryCard">
          <div class="summaryLabel">Total Bongkar (Receiving)</div>
          <div class="summaryValue">${selectedInbound.total_received_qty || 0}</div>
        </div>
        <div class="summaryCard">
          <div class="summaryLabel">Jumlah Inbound</div>
          <div class="summaryValue">${totalInboundQty}</div>
        </div>
      </div>

      <h2>Model Summary</h2>
      <table>
        <thead>
          <tr>
            <th>Photo</th>
            <th>Model Name</th>
            <th class="qty">Qty</th>
          </tr>
        </thead>
        <tbody>
          ${summaryRowsHtml}
          <tr>
            <td><strong>Total</strong></td>
            <td class="qty"><strong>${totalInboundQty}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
    <script>window.onload = function () { window.print(); };</script>
  </body>
</html>`

    printWindow.document.open()
    printWindow.document.write(printHtml)
    printWindow.document.close()
  }

  function handleSaveModel() {
    setModelModalError('')

    if (!modelDraft.model_name.trim()) {
      setModelModalError('Model name is required.')
      return
    }

    if (!selectedBrandId || !selectedCategory) {
      setModelModalError('Choose brand and category first before adding a new model.')
      return
    }

    const saveModel = async () => {
      setSaving(true)

      let photoUrl = modelDraft.photo_url || ''
      if (modelPhotoFile) {
        const fileExt = modelPhotoFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${fileExt}`
        const filePath = `${selectedBrandId}/${selectedCategory.id}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('product-photos')
          .upload(filePath, modelPhotoFile, { upsert: false })

        if (uploadError) {
          setModelModalError(uploadError.message)
          setSaving(false)
          return
        }

        const { data: publicUrlData } = supabase.storage
          .from('product-photos')
          .getPublicUrl(filePath)

        photoUrl = publicUrlData.publicUrl || ''
      }

      const nextModel = {
        brand_id: Number(selectedBrandId),
        category_id: selectedCategory.id,
        model_name: modelDraft.model_name.trim().toUpperCase(),
        model_color: modelDraft.model_color.trim().toUpperCase(),
        photo_url: photoUrl,
        is_active: true,
      }

      const { data: insertedModel, error: insertError } = await supabase
      .from('dir_product_models')
        .insert([nextModel])
        .select('id, brand_id, category_id, model_name, model_color, photo_url')
        .single()

      if (insertError) {
        setModelModalError(insertError.message)
        setSaving(false)
        return
      }

      setProductModels((prev) => [...prev, insertedModel])
      setSelectedModel(insertedModel)
      setSelectedVariantLabel('')
      setModelDraft({
        model_name: '',
        model_color: '',
        photo_url: '',
      })
      setModelPhotoFile(null)
      setShowModelModal(false)
      setShowChooseModelModal(false)
      setModelModalError('')
      setError('')
      setSuccess('Model saved successfully.')
      setSaving(false)
    }

    saveModel()
  }

  async function handleAddToUnload() {
    setError('')
    setSuccess('')

    if (!selectedInbound) {
      setError('Please choose GRN Number first.')
      return
    }

    if (!isReturn && !selectedBrandId) {
      setError('Please choose a brand.')
      return
    }

    if (!isReturn && !selectedCategory) {
      setError('Please choose the category levels first.')
      return
    }

    if (!isReturn && !selectedModel?.model_name) {
      setError('Please choose or add a model first.')
      return
    }

    if (!qty || Number(qty) <= 0) {
      setError('Qty must be greater than 0.')
      return
    }

    if (!picName.trim()) {
      setError('PIC is required.')
      return
    }

    setSaving(true)

    const payload = {
      inbound_id: selectedInbound.id,
      brand_id: selectedBrandId ? Number(selectedBrandId) : null,
      category_id: selectedCategory?.id || null,
      model_name: selectedModel?.model_name || null,
      model_color: selectedModel?.model_color || null,
      variant_label: selectedVariantLabel || null,
      qty: Number(qty),
      pic_name: picName.trim().toUpperCase(),
      photo_url: selectedModel?.photo_url || null,
    }

    if (!isReturn && !isSample) {
      setCurrentKoliItems((prev) => [
        ...prev,
        {
          tempId: `${Date.now()}-${prev.length}`,
          ...payload,
        },
      ])
      resetAddForm({ keepPicName: true })
      setSuccess(`Item added to Current Koli ${nextKoliSequence}.`)
      setSaving(false)
      return
    }

    const { error: insertError } = isReturn
      ? await supabase.from('warehouse_returns').insert([
          {
            inbound_id: payload.inbound_id,
            brand_id: payload.brand_id,
            category_id: payload.category_id,
            model_name: payload.model_name,
            model_color: payload.model_color,
            ...(supportsReturnVariant ? { variant_label: payload.variant_label } : {}),
            qty: payload.qty,
            pic_name: payload.pic_name,
            source_phase: 'inbound',
          },
        ])
      : await supabase.from('inbound_unload').insert([
          {
            ...payload,
            ...(supportsUnloadVariant ? { variant_label: payload.variant_label } : {}),
            is_sample: true,
            koli_sequence: null,
          },
        ])

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    try {
      await refreshUnloadData(selectedInbound.id)
    } catch (refreshError) {
      setError(refreshError.message)
      setSaving(false)
      return
    }

    resetAddForm()
    setSuccess(isReturn ? 'Return row added successfully.' : 'Sample row added successfully.')
    setSaving(false)
  }

  async function handlePostCurrentKoli() {
    setError('')
    setSuccess('')

    if (!selectedInbound) {
      setError('Please choose GRN Number first.')
      return
    }

    if (!currentKoliItems.length) {
      setError('Current Koli does not have any item yet.')
      return
    }

    setSaving(true)

    const payload = currentKoliItems.map((item) => ({
      inbound_id: item.inbound_id,
      brand_id: item.brand_id,
      category_id: item.category_id,
      model_name: item.model_name,
      model_color: item.model_color,
      ...(supportsUnloadVariant ? { variant_label: item.variant_label || null } : {}),
      qty: item.qty,
      pic_name: item.pic_name,
      photo_url: item.photo_url,
      is_sample: false,
      koli_sequence: nextKoliSequence,
    }))

    const { error: insertError } = await supabase.from('inbound_unload').insert(payload)

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    try {
      await refreshUnloadData(selectedInbound.id)
    } catch (refreshError) {
      setError(refreshError.message)
      setSaving(false)
      return
    }

    setCurrentKoliItems([])
    resetAddForm()
    setSuccess(`Current Koli ${nextKoliSequence} posted successfully.`)
    setSaving(false)
  }

  function handleRemoveCurrentKoliItem(tempId) {
    setCurrentKoliItems((prev) => prev.filter((item) => item.tempId !== tempId))
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Unload</h1>
          <p style={styles.subtitle}>Break each GRN into brand, category, model, and per-koli unload lines.</p>
        </div>
      </div>

      <div style={styles.card}>
        <div>
          <h2 style={styles.sectionTitle}>Unload Header</h2>
          <p style={styles.sectionSubtitle}>Choose the GRN first, then continue with the unload breakdown.</p>
        </div>

        {loading ? <p style={styles.emptyText}>Loading unload setup...</p> : null}

        <div style={styles.grid}>
          <div style={styles.field}>
            <label style={styles.label}>GRN Number</label>
            <input
              list="inbound-ro-options"
              value={roSearch}
              onChange={(event) => handleRoSearchChange(event.target.value)}
              style={styles.input}
              placeholder="Type or choose GRN Number"
            />
            <datalist id="inbound-ro-options">
              {inbounds.map((item) => (
                <option key={item.id} value={item.grn_number} />
              ))}
            </datalist>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Qty Surat Jalan</label>
            <div style={styles.readonlyBox}>{selectedInbound?.total_claimed_qty || 0}</div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Qty Bongkar</label>
            <div style={styles.readonlyBox}>{selectedInbound?.total_received_qty || 0}</div>
          </div>
        </div>

        {selectedInbound ? (
          <div style={styles.headerSummaryGrid}>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Inbound Date</span>
              <strong style={styles.summaryValue}>{formatDateDisplay(selectedInbound.inbound_date)}</strong>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Supplier</span>
              <strong style={styles.summaryValue}>{selectedInbound.suppliers?.supplier_name || '-'}</strong>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Barang</span>
              <strong style={styles.summaryValue}>{selectedInbound.item_name || '-'}</strong>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>GRN Selected</span>
              <strong style={styles.summaryValue}>{selectedInbound.grn_number}</strong>
            </div>
          </div>
        ) : (
          <p style={styles.emptyText}>Choose a GRN number to start unloading.</p>
        )}
      </div>

      <div style={styles.card}>
        <div>
          <h2 style={styles.sectionTitle}>Add To Unload</h2>
          <p style={styles.sectionSubtitle}>Regular items go into the current koli builder first. Sample and retur stay outside koli and can be added directly.</p>
        </div>

        {!isReturn && !isSample ? (
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Current Koli</span>
            <strong style={styles.summaryValue}>Koli {nextKoliSequence}</strong>
            <span style={styles.helperText}>
              Add multiple items here, then post them together as one koli.
            </span>
          </div>
        ) : null}

        <div style={styles.field}>
          <label style={styles.label}>Retur</label>
          <div style={styles.toggleWrap}>
            <button
              type="button"
              onClick={() => {
                const nextValue = !isReturn
                setIsReturn(nextValue)
                if (nextValue) {
                  setIsSample(false)
                }
              }}
              style={styles.toggleButton}
              aria-pressed={isReturn}
              aria-label={isReturn ? 'Disable retur mode' : 'Enable retur mode'}
              title={isReturn ? 'Retur active' : 'Retur inactive'}
            >
              <span
                style={{
                  ...styles.toggleTrack,
                  backgroundColor: isReturn ? '#22c55e' : '#cbd5e1',
                }}
              >
                <span
                  style={{
                    ...styles.toggleThumb,
                    transform: isReturn ? 'translateX(20px)' : 'translateX(0)',
                  }}
                />
              </span>
            </button>
            <span>{isReturn ? 'Retur active' : 'Retur inactive'}</span>
          </div>
          <span style={styles.helperText}>
            If retur is active, brand, category, and model can be left empty. Qty still must be filled.
          </span>
        </div>

        <div style={styles.grid}>
          <div style={styles.field}>
            <label style={styles.label}>Brand</label>
            <input
              list="brand-options"
              value={brandSearch}
              onChange={(event) => handleBrandSearchChange(event.target.value)}
              style={styles.input}
              placeholder="Type and filter brand"
            />
            <datalist id="brand-options">
              {brands.map((brand) => (
                <option
                  key={brand.id}
                  value={`${brand.brand_name}${brand.brand_code ? ` (${brand.brand_code})` : ''}`}
                />
              ))}
            </datalist>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Category Level 0</label>
            <select
              value={level0Id}
              onChange={(event) => {
                setLevel0Id(event.target.value)
                setLevel1Id('')
                setLevel2Id('')
                setSelectedModel(null)
                setSelectedVariantLabel('')
              }}
              style={styles.select}
            >
              <option value="">Choose Level 0</option>
              {level0Options.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.category_name}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Category Level 1</label>
            <select
              value={level1Id}
              onChange={(event) => {
                setLevel1Id(event.target.value)
                setLevel2Id('')
                setSelectedModel(null)
                setSelectedVariantLabel('')
              }}
              style={styles.select}
              disabled={!level0Id || level1Options.length === 0}
            >
              <option value="">
                {level0Id
                  ? level1Options.length === 0
                    ? 'No Level 1'
                    : 'Choose Level 1'
                  : 'Choose Level 0 first'}
              </option>
              {level1Options.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.category_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={styles.grid}>
          <div style={styles.field}>
            <label style={styles.label}>Category Level 2</label>
            <select
              value={level2Id}
              onChange={(event) => {
                setLevel2Id(event.target.value)
                setSelectedModel(null)
                setSelectedVariantLabel('')
              }}
              style={styles.select}
              disabled={!level1Id || level2Options.length === 0}
            >
              <option value="">
                {level1Id
                  ? level2Options.length === 0
                    ? 'No Level 2'
                    : 'Choose Level 2'
                  : 'Choose Level 1 first'}
              </option>
              {level2Options.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.category_name}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Model</label>
            <div style={styles.inlineRow}>
              <div style={styles.readonlyBox}>
                {selectedModel
                  ? getModelDisplayLabel(
                      selectedModel.model_name,
                      selectedModel.model_color,
                      selectedVariantLabel || ''
                    )
                  : 'No model selected'}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!selectedBrandId || !selectedCategory) {
                    setError('Choose brand and category first before selecting a model.')
                    return
                  }

                  setShowChooseModelModal(true)
                  setError('')
                }}
                style={styles.iconButton}
                aria-label="Choose model"
                title="Choose model"
              >
                ⌕
              </button>
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Qty</label>
            <input
              type="number"
              min="1"
              value={qty}
              onChange={(event) => setQty(event.target.value)}
              style={styles.input}
              placeholder="0"
            />
          </div>
        </div>

        <div style={styles.grid}>
          <div style={styles.field}>
            <label style={styles.label}>PIC</label>
            <input
              value={picName}
              onChange={(event) => setPicName(event.target.value.toUpperCase())}
              style={styles.input}
              placeholder="PIC NAME"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Product ID Variant</label>
            {selectedModel ? (
              selectedModelVariants.length ? (
                <select
                  value={selectedVariantLabel}
                  onChange={(event) => setSelectedVariantLabel(event.target.value)}
                  style={styles.select}
                >
                  {selectedModelVariants.map((item) => (
                    <option key={item.id || item.variant_label} value={item.variant_label || ''}>
                      {item.variant_label || '-'}{item.variant_name ? ` - ${item.variant_name}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div style={styles.readonlyBox}>No saved variant yet for this model</div>
              )
            ) : (
              <div style={styles.readonlyBox}>Choose model first</div>
            )}
            <span style={styles.helperText}>
              Kalau model ini sudah pernah punya variant dari Packing List, tinggal pilih variant yang sesuai.
            </span>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Add Type</label>
            <label style={styles.checkboxWrap}>
              <input
                type="checkbox"
                checked={isSample}
                onChange={(event) => setIsSample(event.target.checked)}
                disabled={isReturn}
              />
              Sample?
            </label>
            <span style={styles.helperText}>
              Checked sample rows go to Sample, not to Koli numbering.
            </span>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Selected Category</label>
            <div style={styles.readonlyBox}>
              {selectedCategory?.full_name || selectedCategory?.category_name || '-'}
            </div>
          </div>
        </div>

        <div style={styles.buttonRow}>
          {error ? <p style={styles.errorText}>{error}</p> : null}
            {success ? <p style={styles.successText}>{success}</p> : null}
            <button
              type="button"
              onClick={handleAddToUnload}
              disabled={saving || loading}
              style={styles.primaryButton}
            >
              {saving ? 'Adding...' : isReturn ? 'Add Return' : isSample ? 'Add Sample' : 'Add Item to Current Koli'}
            </button>
          </div>
        </div>

        {!isReturn && !isSample ? (
          <div style={styles.card}>
            <div style={styles.header}>
              <div>
                <h2 style={styles.sectionTitle}>Current Koli Items</h2>
                <p style={styles.sectionSubtitle}>These items will be posted together into Koli {nextKoliSequence}.</p>
              </div>
              <button
                type="button"
                onClick={handlePostCurrentKoli}
                disabled={saving || !currentKoliItems.length}
                style={{
                  ...styles.primaryButton,
                  ...(saving || !currentKoliItems.length ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                }}
              >
                {saving ? 'Posting...' : `Post Current Koli ${nextKoliSequence}`}
              </button>
            </div>

            {currentKoliItems.length === 0 ? (
              <p style={styles.emptyText}>No item in the current koli yet.</p>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Brand</th>
                      <th style={styles.th}>Category</th>
                      <th style={styles.th}>Model</th>
                      <th style={styles.th}>Qty</th>
                      <th style={styles.th}>PIC</th>
                      <th style={styles.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentKoliItems.map((row) => {
                      const brand = brands.find((item) => item.id === row.brand_id)
                      const category = categoryMaps.byId.get(row.category_id)
                      const modelLabel = getModelDisplayLabel(row.model_name, row.model_color, row.variant_label)

                      return (
                        <tr key={row.tempId}>
                          <td style={styles.td}>{brand?.brand_name || '-'}</td>
                          <td style={styles.td}>{category?.full_name || category?.category_name || '-'}</td>
                          <td style={styles.td}>{modelLabel || '-'}</td>
                          <td style={styles.td}>{row.qty || 0}</td>
                          <td style={styles.td}>{row.pic_name || '-'}</td>
                          <td style={styles.td}>
                            <button
                              type="button"
                              onClick={() => handleRemoveCurrentKoliItem(row.tempId)}
                              style={styles.secondaryButton}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.sectionTitle}>Unload Result</h2>
            <p style={styles.sectionSubtitle}>Posted koli rows appear here. Samples and retur stay outside koli but still count in inbound totals.</p>
            </div>
          <button
            type="button"
            onClick={handlePrintUnloadDocument}
            style={styles.secondaryButton}
          >
            Print Unload Document
          </button>
        </div>

        <div style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Jumlah Koli</span>
            <strong style={styles.summaryValue}>{totalKoli}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Jumlah Sample</span>
            <strong style={styles.summaryValue}>{totalSampleQty}</strong>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabelRow}>
              <span style={styles.summaryLabel}>Jumlah Diproses</span>
              <span style={styles.tooltipWrap}>
                <button
                  type="button"
                  style={styles.tooltipButton}
                  aria-label="Jumlah Diproses info"
                  title="Jumlah Diproses info"
                  onMouseEnter={() => setShowProcessedTooltip(true)}
                  onMouseLeave={() => setShowProcessedTooltip(false)}
                  onFocus={() => setShowProcessedTooltip(true)}
                  onBlur={() => setShowProcessedTooltip(false)}
                >
                  i
                </button>
                <span
                  style={{
                    ...styles.tooltipBox,
                    opacity: showProcessedTooltip ? 1 : 0,
                    visibility: showProcessedTooltip ? 'visible' : 'hidden',
                    transform: showProcessedTooltip ? 'translateY(0)' : 'translateY(-4px)',
                  }}
                >
                  Jumlah barang yang dilanjutkan ke proses berikutnya, termasuk sample.
                </span>
              </span>
            </div>
            <strong style={styles.summaryValue}>{totalProcessedQty}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Jumlah Retur</span>
            <strong style={styles.summaryValue}>{totalReturnQty}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Jumlah Inbound</span>
            <strong style={styles.summaryValue}>{totalInboundQty}</strong>
          </div>
        </div>

        {resultRows.length === 0 ? (
          <p style={styles.emptyText}>No unload rows yet.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, ...styles.koliHeader }}>Koli</th>
                  <th style={styles.th}>Brand</th>
                  <th style={styles.th}>Category</th>
                  <th style={styles.th}>Model</th>
                  <th style={styles.th}>Qty</th>
                  <th style={styles.th}>PIC</th>
                </tr>
              </thead>
              <tbody>
                {resultRows.map((row) => {
                  const brand = brands.find((item) => item.id === row.brand_id)
                  const category = categoryMaps.byId.get(row.category_id)
                  const modelLabel = getModelDisplayLabel(row.model_name, row.model_color, row.variant_label)

                  return (
                    <tr key={row.id}>
                      <td style={{ ...styles.td, ...styles.koliCell }}>
                        {row.rowType === 'return' ? (
                          <span style={styles.returnBadge}>Retur</span>
                        ) : row.rowType === 'sample' ? (
                          <span style={styles.sampleBadge}>Sample</span>
                        ) : (
                          `Koli ${row.koli_sequence}`
                        )}
                      </td>
                      <td style={styles.td}>{brand?.brand_name || '-'}</td>
                      <td style={styles.td}>{category?.full_name || category?.category_name || '-'}</td>
                      <td style={styles.td}>{modelLabel || '-'}</td>
                      <td style={styles.td}>{row.qty || 0}</td>
                      <td style={styles.td}>
                        <div style={styles.actionInline}>
                          <span>{row.pic_name || '-'}</span>
                          {row.rowType === 'koli' ? (
                            <button
                              type="button"
                              onClick={() => handlePrintKoli(koliGroups.find((item) => Number(item.koli_sequence) === Number(row.koli_sequence)))}
                              style={styles.printButton}
                            >
                              Print
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {showModelModal ? (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div>
              <h2 style={styles.sectionTitle}>Add New Model</h2>
              <p style={styles.sectionSubtitle}>Save the model info for this unload session, then use it in the list.</p>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Nama Model</label>
              <input
                value={modelDraft.model_name}
                onChange={(event) =>
                  setModelDraft((prev) => ({
                    ...prev,
                    model_name: event.target.value.toUpperCase(),
                  }))
                }
                style={styles.input}
                placeholder="MODEL NAME"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Warna Model</label>
              <input
                value={modelDraft.model_color}
                onChange={(event) =>
                  setModelDraft((prev) => ({
                    ...prev,
                    model_color: event.target.value.toUpperCase(),
                  }))
                }
                style={styles.input}
                placeholder="MODEL COLOR"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Foto Produk</label>
              <input type="file" accept="image/*" capture="environment" onChange={handleModelPhotoChange} style={styles.input} />
              <span style={styles.helperText}>Can choose from gallery or take photo directly from camera on mobile.</span>
            </div>

            {modelModalError ? <p style={styles.errorText}>{modelModalError}</p> : null}

            {modelDraft.photo_url ? (
              <Image
                src={modelDraft.photo_url}
                alt="Model preview"
                width={96}
                height={96}
                unoptimized
                style={styles.imagePreview}
              />
            ) : null}

            <div style={styles.buttonRow}>
              <button
                type="button"
                onClick={() => {
                  setShowModelModal(false)
                  setModelDraft({
                    model_name: '',
                    model_color: '',
                    photo_url: '',
                  })
                  setModelPhotoFile(null)
                  setModelModalError('')
                }}
                style={styles.secondaryButton}
              >
                Cancel
              </button>
              <button type="button" onClick={handleSaveModel} style={styles.primaryButton}>
                Save Model
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showChooseModelModal ? (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div>
              <h2 style={styles.sectionTitle}>Choose Existing Model</h2>
              <p style={styles.sectionSubtitle}>
                Showing models filtered by the selected brand and category only.
              </p>
            </div>

            <div style={styles.modelPickerCard}>
              {!selectedBrandId || !selectedCategory ? (
                <p style={styles.emptyText}>Choose brand and category first to see matching models.</p>
              ) : filteredModelOptions.length === 0 ? (
                <p style={styles.emptyText}>No existing model found for this brand and category yet.</p>
              ) : (
                <div style={styles.modelGrid}>
                  {filteredModelOptions.map((item, index) => {
                    const label = item.model_color
                      ? `${item.model_name} / ${item.model_color}`
                      : item.model_name
                    const isSelected =
                      selectedModel?.model_name === item.model_name &&
                      (selectedModel?.model_color || '') === (item.model_color || '')

                    return (
                      <button
                        key={`${item.model_name}-${item.model_color || ''}-${index}`}
                        type="button"
                        onClick={() => {
                          setSelectedModel(item)
                          setSelectedVariantLabel(getDefaultVariantLabelForModel(item))
                          setShowChooseModelModal(false)
                        }}
                        style={{
                          ...styles.modelOptionCard,
                          borderColor: isSelected ? '#111827' : '#d1d5db',
                          boxShadow: isSelected ? '0 0 0 2px rgba(17, 24, 39, 0.08)' : 'none',
                        }}
                      >
                        {item.photo_url ? (
                          <Image
                            src={item.photo_url}
                            alt={label}
                            width={180}
                            height={120}
                            unoptimized
                            style={styles.modelThumb}
                          />
                        ) : (
                          <div
                            style={{
                              ...styles.modelThumb,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#9ca3af',
                              fontSize: '12px',
                              fontWeight: '600',
                            }}
                          >
                            NO PHOTO
                          </div>
                        )}
                        <span style={styles.modelOptionTitle}>{item.model_name}</span>
                        <span style={styles.modelOptionMeta}>{item.model_color || 'NO COLOR'}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={styles.buttonRow}>
              <button
                type="button"
                onClick={() => {
                  setShowChooseModelModal(false)
                  setShowModelModal(true)
                  setModelModalError('')
                }}
                style={styles.secondaryButton}
              >
                + Add New Model
              </button>
              <button
                type="button"
                onClick={() => setShowChooseModelModal(false)}
                style={styles.secondaryButton}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {previewImage ? (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.header}>
              <div>
                <h2 style={styles.sectionTitle}>Model Photo Preview</h2>
                <p style={styles.sectionSubtitle}>{previewImage.title}</p>
              </div>
              <button type="button" onClick={closeImagePreview} style={styles.secondaryButton}>
                Close
              </button>
            </div>

            <Image
              src={previewImage.src}
              alt={previewImage.title}
              width={520}
              height={520}
              unoptimized
              style={{
                width: '100%',
                height: 'auto',
                maxHeight: '70vh',
                objectFit: 'contain',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                background: '#fff',
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
