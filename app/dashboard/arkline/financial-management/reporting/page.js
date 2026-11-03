'use client'

import { useEffect, useState } from 'react'

import { createClient } from '@/utils/supabase/browser'

import useArklineAccess from '../../use-arkline-access'
import styles from '../financial-management.module.css'
import ExpenseExplorer from './expense-explorer'

const supabase = createClient()

function normalizePaidRow(row) {
  return {
    ...row,
    id: row?.id || '',
    source: 'PAYMENT',
    payment_basis: row?.payment_basis || 'NON_PO_BASED',
    po_source_type: row?.po_source_type || '',
    po_number: row?.po_number || '',
    category_name: row?.category?.name || row?.supplier_name_snapshot || 'Manual / Unlinked',
    amount: Number(row?.amount || 0),
    paid_at: row?.paid_at || '',
  }
}

function normalizeReimbursementRow(row) {
  return {
    ...row,
    id: row?.id || '',
    source: 'REIMBURSEMENT',
    group: String(row?.group || '').trim(),
    category_name: row?.category?.name || 'Reimbursement',
    amount: Number(row?.total_amount || 0),
    paid_at: row?.paid_at || '',
  }
}

function normalizePoNumber(value) {
  return String(value || '').trim().toUpperCase()
}

function toNumber(value) {
  const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function getPaidAmountByPo(rows) {
  return (rows || []).reduce((map, row) => {
    if (row.payment_basis !== 'PO_BASED') return map
    const sourceType = String(row.po_source_type || '').trim().toUpperCase()
    const poNumber = normalizePoNumber(row.po_number)
    if (!sourceType || !poNumber) return map
    const key = `${sourceType}:${poNumber}`
    map.set(key, (map.get(key) || 0) + Number(row.amount || 0))
    return map
  }, new Map())
}

function buildOpenReturnQtyByItem(returnBatchRows) {
  return (returnBatchRows || []).reduce((map, row) => {
    const itemId = String(row.arkline_po_item_id || '').trim()
    if (!itemId) return map
    const sentQty = toNumber(row.sent_qty)
    const returnedQty = toNumber(row.returned_qty)
    const shortQty = toNumber(row.short_qty)
    const openReturnQty = Math.max(sentQty - returnedQty - shortQty, 0)
    if (openReturnQty <= 0) return map
    map.set(itemId, (map.get(itemId) || 0) + openReturnQty)
    return map
  }, new Map())
}

function getGarmentPayableQty(row, openReturnQty) {
  const status = normalizePoNumber(row.status)
  if (status !== 'COMPLETED') {
    return toNumber(row.total_qty)
  }

  return Math.max(toNumber(row.actual_qty) - openReturnQty, 0)
}

function buildAccountPayableRows({ garmentPoRows, garmentItemRows, materialPoRows, materialItemRows, paidRows, returnBatchRows }) {
  const paidByPo = getPaidAmountByPo(paidRows)
  const openReturnQtyByItem = buildOpenReturnQtyByItem(returnBatchRows)

  const garmentTotals = (garmentItemRows || []).reduce((map, row) => {
    const poNumber = normalizePoNumber(row.po_id)
    if (!poNumber) return map
    const itemId = String(row.id || '').trim()
    const openReturnQty = openReturnQtyByItem.get(itemId) || 0
    const qty = getGarmentPayableQty(row, openReturnQty)
    const price = toNumber(row.price ?? row.hpp)
    const existing = map.get(poNumber) || { amount: 0, hasOpenReturn: false }
    map.set(poNumber, {
      amount: existing.amount + qty * price,
      hasOpenReturn: existing.hasOpenReturn || openReturnQty > 0,
    })
    return map
  }, new Map())

  const materialTotals = (materialItemRows || []).reduce((map, row) => {
    const poNumber = normalizePoNumber(row.material_po_number)
    if (!poNumber) return map
    const amount = toNumber(row.amount) || toNumber(row.qty) * toNumber(row.price)
    map.set(poNumber, (map.get(poNumber) || 0) + amount)
    return map
  }, new Map())

  const garmentRows = (garmentPoRows || [])
    .filter((row) => normalizePoNumber(row.status) !== 'CANCELLED' && normalizePoNumber(row.status) !== 'CANCELED')
    .map((row) => {
      const poNumber = normalizePoNumber(row.po_id)
      const total = garmentTotals.get(poNumber) || { amount: 0, hasOpenReturn: false }
      const paidAmount = paidByPo.get(`GARMENT:${poNumber}`) || 0
      return {
        id: `GARMENT-${row.id || poNumber}`,
        amount: Math.max(total.amount - paidAmount, 0),
        hasOpenReturn: total.hasOpenReturn,
        created_at: row.created_at || '',
      }
    })

  const materialRows = (materialPoRows || [])
    .filter((row) => normalizePoNumber(row.status) !== 'CANCELLED' && normalizePoNumber(row.status) !== 'CANCELED')
    .map((row) => {
      const poNumber = normalizePoNumber(row.material_po_number)
      const totalAmount = materialTotals.get(poNumber) || 0
      const paidAmount = paidByPo.get(`MATERIAL:${poNumber}`) || 0
      return {
        id: `MATERIAL-${row.id || poNumber}`,
        amount: Math.max(totalAmount - paidAmount, 0),
        hasOpenReturn: false,
        created_at: row.created_at || '',
      }
    })

  return [...garmentRows, ...materialRows].filter((row) => Number(row.amount || 0) > 0)
}

export default function ArklineFinancialReportingPage() {
  const { loading: accessLoading, access } = useArklineAccess()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [paidRequests, setPaidRequests] = useState([])
  const [paidReimbursements, setPaidReimbursements] = useState([])
  const [accountPayables, setAccountPayables] = useState([])

  useEffect(() => {
    let active = true

    Promise.all([
      supabase
        .from('arkline_payment')
        .select(
          `
            id,
            supplier_name_snapshot,
            category:dir_reimbursement_categories(name),
            payment_basis,
            po_source_type,
            po_number,
            invoice_number, notes, account_name, bank_name, account_number,
            created_by, created_at, approved_by, approved_at, paid_by,
            amount,
            paid_at
          `
        )
        .eq('status', 'PAID')
        .order('paid_at', { ascending: false }),
      supabase
        .from('hrga_reimbursement_claims')
        .select(
          `
            id,
            "group",
            claim_number, employee_authenticated_id, employee_email_snapshot, employee_name_snapshot,
            expense_date, description, payee_bank_name, payee_account_name, payee_account_number,
            submitted_at, created_by, created_at, approved_by, approved_at, paid_by,
            total_amount,
            paid_at,
            category:dir_reimbursement_categories(name)
          `
        )
        .eq('status', 'PAID')
        .order('paid_at', { ascending: false }),
      supabase
        .from('arkline_pos')
        .select('id, po_id, status, created_at')
        .not('po_id', 'is', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('arkline_po_items')
        .select('id, po_id, total_qty, actual_qty, status, price, hpp'),
      supabase
        .from('arkline_po_material_ordered')
        .select('id, material_po_number, status, created_at')
        .not('material_po_number', 'is', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('arkline_po_material_ordered_items')
        .select('material_po_number, qty, price, amount'),
      supabase
        .from('arkline_qc_return_batches')
        .select('arkline_po_item_id, sent_qty, returned_qty, short_qty'),
      supabase.from('dir_user_profiles').select('email, display_name'),
    ]).then(([paymentResult, reimbursementResult, garmentPoResult, garmentItemResult, materialPoResult, materialItemResult, returnBatchResult, profileResult]) => {
      if (!active) return

      if (
        paymentResult.error ||
        reimbursementResult.error ||
        garmentPoResult.error ||
        garmentItemResult.error ||
        materialPoResult.error ||
        materialItemResult.error ||
        returnBatchResult.error
      ) {
        setError(
          paymentResult.error?.message ||
            reimbursementResult.error?.message ||
            garmentPoResult.error?.message ||
            garmentItemResult.error?.message ||
            materialPoResult.error?.message ||
            materialItemResult.error?.message ||
            returnBatchResult.error?.message ||
            'Failed to load financial reporting.'
        )
        setLoading(false)
        return
      }

      const names = new Map((profileResult.data || []).map(profile => [String(profile.email || '').trim().toLowerCase(), profile.display_name]))
      const resolveName = email => names.get(String(email || '').trim().toLowerCase()) || email || 'Not recorded'
      function withPeople(row) {
        const employeeEmail = row.employee_email_snapshot
        const requester = employeeEmail || row.created_by
        return {
          ...row,
          requester_id: String(requester || row.employee_authenticated_id || 'UNKNOWN').trim().toLowerCase(),
          requester_name: names.get(String(employeeEmail || '').trim().toLowerCase()) || row.employee_name_snapshot || resolveName(row.created_by),
          submitted_by_name: resolveName(row.created_by),
          approved_by_name: resolveName(row.approved_by),
          paid_by_name: resolveName(row.paid_by),
        }
      }
      const normalizedPayments = (paymentResult.data || []).map(normalizePaidRow).map(withPeople)
      setPaidRequests(normalizedPayments)
      setPaidReimbursements((reimbursementResult.data || []).map(normalizeReimbursementRow).map(withPeople))
      setAccountPayables(
        buildAccountPayableRows({
          garmentPoRows: garmentPoResult.data || [],
          garmentItemRows: garmentItemResult.data || [],
          materialPoRows: materialPoResult.data || [],
          materialItemRows: materialItemResult.data || [],
          paidRows: normalizedPayments,
          returnBatchRows: returnBatchResult.data || [],
        })
      )
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [])

  if (loading || accessLoading) return <div className={styles.emptyState}>Loading financial reporting...</div>
  if (!access.financialReporting) return <div className={styles.emptyState}>Your account does not have Arkline financial reporting access yet.</div>
  if (error) return <div role="alert" className={styles.emptyState}>{error}</div>
  return <ExpenseExplorer payments={paidRequests} reimbursements={paidReimbursements} payables={accountPayables} />
}
