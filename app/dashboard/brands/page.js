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
  return query ? `/dashboard/brands?${query}` : '/dashboard/brands'
}

async function toggleBrandStatus(formData) {
  'use server'

  const supabase = await createClient()
  const brandId = formData.get('brandId')
  const nextActiveValue = formData.get('nextActiveValue') === 'true'

  const { error } = await supabase
    .from('brands')
    .update({ is_active: nextActiveValue })
    .eq('id', brandId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard/brands')
}

export default async function BrandsPage({ searchParams }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const query = (getSingleValue(searchParams?.q) || '').trim()
  const pageSize = getPageSize(searchParams?.pageSize)
  const currentPage = getPage(searchParams?.page)
  const from = (currentPage - 1) * pageSize
  const to = from + pageSize - 1

  let brandsQuery = supabase
    .from('brands')
    .select('*', { count: 'exact' })
    .order('id', { ascending: true })

  if (query) {
    brandsQuery = brandsQuery.or(
      `brand_code.ilike.%${query}%,brand_name.ilike.%${query}%,description.ilike.%${query}%`
    )
  }

  const { data: brands, error, count } = await brandsQuery.range(from, to)
  const totalItems = count || 0
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 1
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const hasPreviousPage = safeCurrentPage > 1
  const hasNextPage = safeCurrentPage < totalPages
  const showingFrom = totalItems === 0 ? 0 : from + 1
  const showingTo = totalItems === 0 ? 0 : Math.min(from + (brands?.length || 0), totalItems)

  return (
    <div>
      <h1 style={styles.title}>Brands</h1>
      <p style={styles.subtitle}>List of brand master data</p>

      <div style={styles.toolbar}>
        <Link href="/dashboard/brands/new" style={styles.addButton}>
          + Add Brand
        </Link>

        <form method="get" style={styles.searchForm}>
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search code, name, or description"
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
      ) : brands?.length === 0 ? (
        <div style={styles.emptyBox}>
          <p style={{ margin: 0 }}>{query ? 'No brands match your search.' : 'No brands yet.'}</p>
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
                  <th style={styles.th}>Description</th>
                  <th style={styles.th}>Active</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((item) => (
                  <tr key={item.id}>
                    <td style={styles.td}>{item.brand_code}</td>
                    <td style={styles.td}>{item.brand_name}</td>
                    <td style={styles.td}>{item.description || '-'}</td>
                    <td style={styles.td}>
                      <form action={toggleBrandStatus} style={styles.toggleForm}>
                        <input type="hidden" name="brandId" value={item.id} />
                        <input
                          type="hidden"
                          name="nextActiveValue"
                          value={item.is_active ? 'false' : 'true'}
                        />
                        <button
                          type="submit"
                          style={styles.toggleButton}
                          aria-label={item.is_active ? 'Deactivate brand' : 'Activate brand'}
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
                      <Link href={`/dashboard/brands/${item.id}`} style={styles.editButton}>
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
    marginBottom: '8px',
    fontSize: '28px',
  },
  subtitle: {
    marginTop: 0,
    marginBottom: '24px',
    color: '#6b7280',
  },
  toolbar: {
    marginBottom: '16px',
    display: 'flex',
    gap: '12px',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  searchForm: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  searchInput: {
    height: '40px',
    minWidth: '260px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
  },
  pageSizeSelect: {
    height: '40px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    background: '#fff',
  },
  filterButton: {
    height: '40px',
    padding: '0 14px',
    borderRadius: '8px',
    border: '1px solid #111827',
    background: '#111827',
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
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #e5e7eb',
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
    borderRadius: '12px',
    overflowX: 'auto',
    border: '1px solid #e5e7eb',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '14px',
    background: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '14px',
  },
  td: {
    padding: '14px',
    borderBottom: '1px solid #f1f5f9',
    fontSize: '14px',
    verticalAlign: 'middle',
  },
  addButton: {
    display: 'inline-block',
    padding: '10px 14px',
    background: '#111827',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
  },
  editButton: {
    display: 'inline-block',
    padding: '8px 12px',
    background: '#2563eb',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '8px',
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
    border: '1px solid #d1d5db',
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
