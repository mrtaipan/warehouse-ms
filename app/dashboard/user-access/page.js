import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { ADMIN_EMAIL, ROLE_OPTIONS } from '@/utils/permissions'
import { updateRolePermissions, updateUserRole } from './actions'

function groupPermissions(items) {
  return items.reduce((accumulator, item) => {
    const groupKey = String(item.code || '').split('.')[0] || 'other'
    if (!accumulator[groupKey]) accumulator[groupKey] = []
    accumulator[groupKey].push(item)
    return accumulator
  }, {})
}

const GROUP_LABELS = {
  storage: 'Storage',
  inbound: 'Inbound',
  qc: 'QC',
  packing: 'Packing',
  masterdata: 'Master Data',
  useraccess: 'User Access',
  other: 'Other',
}

export default async function UserAccessPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  if (user.email?.toLowerCase() !== ADMIN_EMAIL) {
    redirect('/dashboard/storage')
  }

  const [{ data: profiles, error: profilesError }, { data: permissions, error: permissionsError }, { data: rolePermissions, error: rolePermissionsError }] =
    await Promise.all([
        supabase.from('dir_user_profiles').select('id, email, display_name, role, updated_at').order('email', { ascending: true }),
      supabase.from('permissions').select('code, label, description').order('code', { ascending: true }),
      supabase.from('role_permissions').select('role, permission_code').order('role', { ascending: true }),
    ])

  const groupedPermissions = groupPermissions(permissions || [])
  const rolePermissionMap = (rolePermissions || []).reduce((accumulator, item) => {
    if (!accumulator[item.role]) accumulator[item.role] = new Set()
    accumulator[item.role].add(item.permission_code)
    return accumulator
  }, {})

  return (
    <div style={styles.wrapper}>
      <div>
        <h1 style={styles.title}>User Access</h1>
        <p style={styles.subtitle}>Atur role per user dan centang permission per role langsung dari UI.</p>
      </div>

      {profilesError || permissionsError || rolePermissionsError ? (
        <div style={styles.card}>
          <p style={styles.errorText}>Error: {profilesError?.message || permissionsError?.message || rolePermissionsError?.message}</p>
        </div>
      ) : null}

      <section style={styles.section}>
        <div>
          <h2 style={styles.sectionTitle}>Users</h2>
          <p style={styles.sectionSubtitle}>Ganti role user satu per satu. Role ini jadi dasar permission yang dibaca sistem.</p>
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.headRow}>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Display Name</th>
                <th style={styles.th}>Role</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {(profiles || []).map((profile) => (
                <tr key={profile.id || profile.email} style={styles.bodyRow}>
                  <td style={styles.td}>{profile.email}</td>
                  <td style={styles.td}>
                    <form id={`access-form-${profile.email}`} action={updateUserRole} style={styles.inlineForm}>
                      <input type="hidden" name="email" value={profile.email} />
                      <input
                        name="display_name"
                        defaultValue={profile.display_name || ''}
                        style={styles.input}
                        placeholder="Display name"
                      />
                    </form>
                  </td>
                  <td style={styles.td}>
                    <select
                      name="role"
                      form={`access-form-${profile.email}`}
                      defaultValue={profile.role || 'storage_staff'}
                      style={styles.select}
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={styles.td}>
                    <button type="submit" form={`access-form-${profile.email}`} style={styles.primaryButton}>
                      Save
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={styles.section}>
        <div>
          <h2 style={styles.sectionTitle}>Role Permissions</h2>
          <p style={styles.sectionSubtitle}>Centang permission per role. Setelah disimpan, sidebar dan route access akan ikut berubah.</p>
        </div>

        <div style={styles.roleGrid}>
          {ROLE_OPTIONS.map((role) => {
            const selectedPermissions = rolePermissionMap[role.value] || new Set()

            return (
              <form key={role.value} action={updateRolePermissions} style={styles.roleCard}>
                <input type="hidden" name="role" value={role.value} />

                <div style={styles.roleHeader}>
                  <div>
                    <h3 style={styles.roleTitle}>{role.label}</h3>
                    <p style={styles.roleSubtitle}>{role.value}</p>
                  </div>
                  <button type="submit" style={styles.primaryButton}>
                    Save
                  </button>
                </div>

                {Object.entries(groupedPermissions).map(([groupKey, items]) => (
                  <div key={groupKey} style={styles.permissionGroup}>
                    <strong style={styles.permissionGroupTitle}>{GROUP_LABELS[groupKey] || groupKey}</strong>

                    <div style={styles.permissionList}>
                      {items.map((permission) => (
                        <label key={`${role.value}-${permission.code}`} style={styles.permissionRow}>
                          <input
                            type="checkbox"
                            name="permission_code"
                            value={permission.code}
                            defaultChecked={selectedPermissions.has(permission.code)}
                          />
                          <div style={styles.permissionText}>
                            <span style={styles.permissionLabel}>{permission.label}</span>
                            <span style={styles.permissionMeta}>
                              {permission.code}
                              {permission.description ? ` - ${permission.description}` : ''}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </form>
            )
          })}
        </div>
      </section>
    </div>
  )
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  title: {
    margin: 0,
    fontSize: '28px',
  },
  subtitle: {
    color: '#6b7280',
    margin: '4px 0 0',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '22px',
    color: '#111827',
  },
  sectionSubtitle: {
    margin: '4px 0 0',
    color: '#6b7280',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '24px',
  },
  tableWrap: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  headRow: {
    background: '#f9fafb',
  },
  bodyRow: {
    borderTop: '1px solid #f1f5f9',
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
  },
  td: {
    padding: '12px 16px',
    fontSize: '14px',
    color: '#111827',
    verticalAlign: 'middle',
  },
  inlineForm: {
    margin: 0,
  },
  input: {
    height: '40px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    width: '100%',
  },
  select: {
    height: '40px',
    padding: '0 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    background: '#fff',
    width: '100%',
  },
  primaryButton: {
    padding: '9px 14px',
    background: '#111827',
    color: '#fff',
    borderRadius: '8px',
    border: 'none',
    fontWeight: '600',
    cursor: 'pointer',
  },
  roleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '16px',
  },
  roleCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  roleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
  },
  roleTitle: {
    margin: 0,
    fontSize: '18px',
    color: '#111827',
  },
  roleSubtitle: {
    margin: '4px 0 0',
    color: '#6b7280',
    fontSize: '13px',
  },
  permissionGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  permissionGroupTitle: {
    fontSize: '13px',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#6b7280',
  },
  permissionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  permissionRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
  },
  permissionText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  permissionLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#111827',
  },
  permissionMeta: {
    fontSize: '12px',
    color: '#6b7280',
    lineHeight: 1.4,
  },
  errorText: {
    margin: 0,
    color: '#dc2626',
  },
}
