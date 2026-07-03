'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

function sanitizeSearch(value) {
  return String(value || '').trim().replace(/[%,()]/g, ' ')
}

function createHref(filters) {
  const params = new URLSearchParams()
  const search = sanitizeSearch(filters.search)

  if (search) {
    params.set('search', search)
  } else {
    if (filters.supplierId) params.set('supplier', filters.supplierId)
    if (filters.month) params.set('month', filters.month)
  }

  const query = params.toString()
  return query ? `/dashboard/qc/confirmation?${query}` : '/dashboard/qc/confirmation'
}

export default function GradingVerificationFiltersClient({ suppliers = [], initialFilters = {} }) {
  const router = useRouter()
  const didMountRef = useRef(false)
  const [filters, setFilters] = useState({
    search: initialFilters.search || '',
    supplierId: initialFilters.supplierId || '',
    month: initialFilters.month || '',
  })

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return undefined
    }

    const timer = window.setTimeout(() => {
      router.replace(createHref(filters))
    }, 250)

    return () => window.clearTimeout(timer)
  }, [filters, router])

  function updateFilter(name, value) {
    setFilters((prev) => {
      if (name === 'search' && sanitizeSearch(value)) {
        return { search: value, supplierId: '', month: '' }
      }

      if ((name === 'supplierId' || name === 'month') && prev.search) {
        return { search: '', supplierId: '', month: '', [name]: value }
      }

      return { ...prev, [name]: value }
    })
  }

  function resetFilters() {
    setFilters({ search: '', supplierId: '', month: '' })
  }

  return (
    <div style={styles.filters}>
      <input
        type="search"
        value={filters.search}
        onChange={(event) => updateFilter('search', event.target.value)}
        placeholder="Search GRN or item"
        aria-label="Search GRN or item"
        style={styles.input}
      />

      <select
        value={filters.supplierId}
        onChange={(event) => updateFilter('supplierId', event.target.value)}
        aria-label="Supplier"
        style={styles.select}
      >
        <option value="">All suppliers</option>
        {suppliers.map((supplier) => (
          <option key={supplier.id} value={supplier.id}>
            {supplier.supplier_name}
          </option>
        ))}
      </select>

      <input
        type="month"
        value={filters.month}
        onChange={(event) => updateFilter('month', event.target.value)}
        aria-label="Month"
        style={styles.input}
      />

      <Link href="/dashboard/qc/confirmation" onClick={resetFilters} style={styles.resetButton}>
        Reset
      </Link>
    </div>
  )
}

const styles = {
  filters: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 1fr) minmax(180px, 220px) 150px auto',
    gap: '12px',
    alignItems: 'center',
  },
  input: {
    height: '38px',
    padding: '0 11px',
    border: '1px solid #cbd5e1',
    borderRadius: '9px',
    fontSize: '13px',
    width: '100%',
    background: '#fff',
    color: '#111827',
  },
  select: {
    height: '38px',
    padding: '0 11px',
    border: '1px solid #cbd5e1',
    borderRadius: '9px',
    fontSize: '13px',
    width: '100%',
    background: '#fff',
    color: '#111827',
  },
  resetButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '38px',
    padding: '0 14px',
    borderRadius: '9px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#334155',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: '800',
    whiteSpace: 'nowrap',
  },
}
