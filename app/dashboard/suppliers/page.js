import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'

const PAGE_SIZE_OPTIONS = [25, 50, 100]

function getSingleValue(value) {
  return Array.isArray(value) ? value[0] : value
}

function getPageSize(value) {
  const parsed = Number.parseInt(getSingleValue(value) || '25', 10)
  return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : 25
}

function getPage(value) {
  const parsed = Number.parseInt(getSingleValue(value) || '1', 10)
  return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed
}

function createPageHref({ q, page, pageSize }) {
  const params = new URLSearchParams()

  if (q) params.set('q', q)
  if (page > 1) params.set('page', String(page))
  if (pageSize !== 25) params.set('pageSize', String(pageSize))

  const query = params.toString()
  return query ? `/dashboard/suppliers?${query}` : '/dashboard/suppliers'
}

async function toggleSupplierStatus(formData) {
  'use server'

  const supabase = await createClient()
  const supplierId = formData.get('supplierId')
  const nextActiveValue = formData.get('nextActiveValue') === 'true'

  const { error } = await supabase
    .from('dir_suppliers')
    .update({ is_active: nextActiveValue })
    .eq('id', supplierId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard/suppliers')
}

export default async function SuppliersPage({ searchParams }) {
  const supabase = await createClient()
  const params = await searchParams

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const query = (getSingleValue(params?.q) || '').trim()
  const pageSize = getPageSize(params?.pageSize)
  const currentPage = getPage(params?.page)
  const from = (currentPage - 1) * pageSize
  const to = from + pageSize - 1

  const loadSuppliers = (start, end) => {
    let request = supabase
      .from('dir_suppliers')
      .select('*', { count: 'exact' })
      .order('id', { ascending: true })

    if (query) {
      request = request.or(
        `supplier_code.ilike.%${query}%,supplier_name.ilike.%${query}%,group.ilike.%${query}%,contact_person.ilike.%${query}%,phone.ilike.%${query}%`
      )
    }

    return request.range(start, end)
  }

  let { data: suppliers, error, count } = await loadSuppliers(from, to)
  const totalItems = count || 0
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 1
  const safeCurrentPage = Math.min(currentPage, totalPages)
  if (safeCurrentPage !== currentPage) {
    const safeFrom = (safeCurrentPage - 1) * pageSize
    ;({ data: suppliers, error } = await loadSuppliers(safeFrom, safeFrom + pageSize - 1))
  }
  const hasPreviousPage = safeCurrentPage > 1
  const hasNextPage = safeCurrentPage < totalPages
  const safeFrom = (safeCurrentPage - 1) * pageSize
  const showingFrom = totalItems === 0 ? 0 : safeFrom + 1
  const showingTo = totalItems === 0 ? 0 : Math.min(safeFrom + (suppliers?.length || 0), totalItems)

  return (
    <div>
      <h1 style={styles.title}>Suppliers</h1>
      <p style={styles.subtitle}>List of supplier master data</p>

      <div style={styles.toolbar}>
        <Link href="/dashboard/suppliers/new" style={styles.addButton}>
          + Add Supplier
        </Link>

        <form method="get" style={styles.searchForm}>
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search code, name, contact, or phone"
            style={styles.searchInput}
          />
          <select name="pageSize" defaultValue={String(pageSize)} style={styles.pageSizeSelect}>
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                Show {option}
              </option>
            ))}
          </select>
          <input type="hidden" name="page" value="1" />
          <button type="submit" style={styles.filterButton}>
            Apply
          </button>
        </form>
      </div>

      {error ? (
        <p style={styles.error}>Error: {error.message}</p>
      ) : suppliers?.length === 0 ? (
        <div style={styles.emptyBox}>
          <p style={{ margin: 0 }}>{query ? 'No suppliers match your search.' : 'No suppliers yet.'}</p>
        </div>
      ) : (
        <>
          <div style={styles.tableMeta}>
            <span>
              Showing {showingFrom}-{showingTo} of {totalItems}
            </span>
            <span>
              Page {safeCurrentPage} of {totalPages}
            </span>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Code</th>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Group</th>
                  <th style={styles.th}>Contact Person</th>
                  <th style={styles.th}>Phone</th>
                  <th style={styles.th}>Active</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((item) => (
                  <tr key={item.id}>
                    <td style={styles.td}>{item.supplier_code}</td>
                    <td style={styles.td}>{item.supplier_name}</td>
                    <td style={styles.td}>{item.group || '-'}</td>
                    <td style={styles.td}>{item.contact_person || '-'}</td>
                    <td style={styles.td}>{item.phone || '-'}</td>
                    <td style={styles.td}>
                      <form action={toggleSupplierStatus} style={styles.toggleForm}>
                        <input type="hidden" name="supplierId" value={item.id} />
                        <input
                          type="hidden"
                          name="nextActiveValue"
                          value={item.is_active ? 'false' : 'true'}
                        />
                        <button
                          type="submit"
                          style={styles.toggleButton}
                          aria-label={item.is_active ? 'Deactivate supplier' : 'Activate supplier'}
                          title={item.is_active ? 'Active' : 'Inactive'}
                        >
                          <span
                            style={{
                              ...styles.toggleTrack,
                              backgroundColor: item.is_active ? '#22c55e' : '#cbd5e1',
                            }}
                          >
                            <span
                              style={{
                                ...styles.toggleThumb,
                                transform: item.is_active ? 'translateX(20px)' : 'translateX(0)',
                              }}
                            />
                          </span>
                        </button>
                      </form>
                    </td>
                    <td style={styles.td}>
                      <Link href={`/dashboard/suppliers/${item.id}`} style={styles.editButton}>
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={styles.pagination}>
            {hasPreviousPage ? (
              <Link
                href={createPageHref({ q: query, page: safeCurrentPage - 1, pageSize })}
                style={styles.pageButton}
              >
                Previous
              </Link>
            ) : (
              <span style={styles.pageButtonDisabled}>Previous</span>
            )}

            {hasNextPage ? (
              <Link
                href={createPageHref({ q: query, page: safeCurrentPage + 1, pageSize })}
                style={styles.pageButton}
              >
                Next
              </Link>
            ) : (
              <span style={styles.pageButtonDisabled}>Next</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

const styles = {
  title: {
    marginTop: 0,
    marginBottom: '4px',
    fontSize: '30px',
    lineHeight: 1.2,
    letterSpacing: '-0.04em',
    color: '#17212b',
  },
  subtitle: {
    marginTop: 0,
    marginBottom: '28px',
    color: '#64748b',
    fontSize: '14px',
  },
  toolbar: {
    marginBottom: '20px',
    display: 'flex',
    gap: '12px',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  searchForm: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  searchInput: {
    height: '40px',
    minWidth: '260px',
    padding: '0 12px',
    border: '1px solid #dbe2e8',
    borderRadius: '10px',
    fontSize: '14px',
  },
  pageSizeSelect: {
    height: '40px',
    padding: '0 12px',
    border: '1px solid #dbe2e8',
    borderRadius: '10px',
    fontSize: '14px',
    background: '#fff',
  },
  filterButton: {
    height: '40px',
    padding: '0 14px',
    borderRadius: '8px',
    border: '1px solid #183b4e',
    background: '#183b4e',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  error: {
    color: 'red',
  },
  emptyBox: {
    background: '#fff',
    borderRadius: '14px',
    padding: '28px',
    border: '1px solid #e2e8ee',
  },
  tableMeta: {
    marginBottom: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
    color: '#6b7280',
    fontSize: '14px',
  },
  tableWrap: {
    background: '#fff',
    borderRadius: '14px',
    overflowX: 'auto',
    border: '1px solid #e2e8ee',
    boxShadow: '0 1px 2px rgba(16, 24, 40, 0.03)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '14px 16px',
    background: '#f6f8fa',
    borderBottom: '1px solid #e7edf1',
    color: '#52616b',
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  td: {
    padding: '15px 16px',
    borderBottom: '1px solid #edf1f4',
    fontSize: '14px',
    verticalAlign: 'middle',
  },
  addButton: {
    display: 'inline-block',
    padding: '10px 14px',
    background: '#183b4e',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '600',
  },
  editButton: {
    display: 'inline-block',
    padding: '8px 12px',
    background: '#eaf1f4',
    color: '#183b4e',
    textDecoration: 'none',
    borderRadius: '9px',
    fontSize: '13px',
    fontWeight: '600',
  },
  toggleForm: {
    margin: 0,
  },
  toggleButton: {
    padding: 0,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
  },
  toggleTrack: {
    width: '44px',
    height: '24px',
    borderRadius: '999px',
    padding: '2px',
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
  pagination: {
    marginTop: '16px',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    flexWrap: 'wrap',
  },
  pageButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '92px',
    height: '38px',
    padding: '0 14px',
    borderRadius: '8px',
    background: '#fff',
    color: '#111827',
    textDecoration: 'none',
    border: '1px solid #dbe2e8',
    fontSize: '14px',
    fontWeight: '600',
  },
  pageButtonDisabled: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '92px',
    height: '38px',
    padding: '0 14px',
    borderRadius: '8px',
    background: '#f3f4f6',
    color: '#9ca3af',
    border: '1px solid #e5e7eb',
    fontSize: '14px',
    fontWeight: '600',
  },
}
