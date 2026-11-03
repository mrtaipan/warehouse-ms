'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'
import styles from './expense-explorer.module.css'

const supabase = createClient()
const money = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
const date = value => value ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', dateStyle: 'medium' }).format(new Date(value)) : 'Not recorded'

export default function ExpenseDetail({ row, onClose }) {
  const dialog = useRef(null)
  const [attachments, setAttachments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const reimbursement = row.source === 'REIMBURSEMENT'
  useEffect(() => {
    const element = dialog.current
    element.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { element.close(); document.body.style.overflow = previousOverflow }
  }, [])
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const { data, error: queryError } = await supabase
          .from(reimbursement ? 'hrga_reimbursement_attachments' : 'arkline_payment_attachments')
          .select('id,storage_bucket,storage_path,file_name')
          .eq(reimbursement ? 'claim_id' : 'payment_id', row.id)
        if (queryError) throw queryError
        const files = await Promise.all((data || []).map(async file => {
          const { data: signed, error: signError } = await supabase.storage.from(file.storage_bucket).createSignedUrl(file.storage_path, 600)
          return { ...file, url: signed?.signedUrl, unavailable: Boolean(signError) }
        }))
        if (active) setAttachments(files)
      } catch (cause) {
        if (active) setError(cause.message || 'Unable to load attachments.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [reimbursement, row.id])

  const facts = [
    ['Category', row.category_name],
    [reimbursement ? 'Employee' : 'Requester', row.requester_name],
    ['Submitted by', row.submitted_by_name],
    ['Submitted on', date(row.submitted_at || row.created_at)],
    ['Approved by', row.approved_by_name],
    ['Approved on', date(row.approved_at)],
    ['Paid by', row.paid_by_name],
    ['Paid on', date(row.paid_at)],
    ...(reimbursement ? [['Expense date', date(row.expense_date)]] : [['PO reference', row.po_number || 'Non-PO'], ['PO type', row.po_source_type || '-']]),
    ['Bank', row.payee_bank_name || row.bank_name || '-'],
    ['Account name', row.payee_account_name || row.account_name || '-'],
    ['Account number', row.payee_account_number || row.account_number || '-'],
  ]
  return <dialog ref={dialog} className={styles.transactionDialog} aria-labelledby="expense-detail-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <header className={styles.dialogHeader}>
      <div><span className={reimbursement ? styles.reimbursement : styles.payment}>{reimbursement ? 'Reimbursement' : 'Payment'} · Paid</span><h2 id="expense-detail-title">{row.claim_number || row.invoice_number || `Record #${row.id}`}</h2></div>
      <button type="button" className={styles.closeDetail} onClick={onClose} aria-label="Close transaction detail" title="Close">&times;</button>
    </header>
    <div className={styles.dialogBody}>
      <div className={styles.detailAmount}><span>Paid amount</span><strong>{money(row.amount)}</strong></div>
      <dl className={styles.detailFacts}>{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl>
      <section className={styles.detailNotes}><h3>{reimbursement ? 'Description' : 'Notes'}</h3><p>{row.description || row.notes || 'No notes recorded.'}</p></section>
      <section className={styles.detailNotes}><h3>Attachments</h3>{loading ? <p role="status">Loading attachments...</p> : error ? <p role="alert">{error}</p> : attachments.length ? <ul>{attachments.map(file => <li key={file.id}>{file.url ? <a href={file.url} target="_blank" rel="noopener noreferrer">{file.file_name}</a> : <span>{file.file_name} (unavailable)</span>}</li>)}</ul> : <p>No attachments.</p>}</section>
    </div>
  </dialog>
}
