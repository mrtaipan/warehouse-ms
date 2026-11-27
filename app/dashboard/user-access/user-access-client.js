'use client'

import { useState } from 'react'
import RolePermissionEditor from './role-permission-editor'

export default function UserAccessClient({
  profiles,
  roleOptions,
  permissionCatalog,
  rolePermissionMap,
  inviteStatus,
  actionStatus,
  inviteMessage,
  updateUserRole,
  updateRolePermissions,
  sendUserInvite,
}) {
  const [activeTab, setActiveTab] = useState('role-permissions')
  const [userSearch, setUserSearch] = useState('')
  const filteredProfiles = (profiles || []).filter((profile) => `${profile.email || ''} ${profile.display_name || ''} ${profile.role || ''}`.toLowerCase().includes(userSearch.trim().toLowerCase()))

  return (
    <div style={styles.wrapper}>
      <div>
        <h1 style={styles.title}>User Access</h1>
        <p style={styles.subtitle}>Kelola pengguna, akses modul, dan shortcut dashboard.</p>
      </div>

      {inviteStatus === 'sent' ? (
        <div style={styles.successBanner}>Invitation email sent. The user can now continue from the invite link.</div>
      ) : null}

      {inviteStatus === 'error' ? (
        <div style={styles.errorBanner}>Failed to send invite: {inviteMessage || 'Unknown error.'}</div>
      ) : null}

      {actionStatus === 'saved' ? (
        <div style={styles.successBanner}>{inviteMessage || 'Changes saved.'}</div>
      ) : null}

      {actionStatus === 'error' ? (
        <div style={styles.errorBanner}>{inviteMessage || 'Failed to save changes.'}</div>
      ) : null}

      <div style={styles.tabRow}>
        <button type="button" style={{ ...styles.tabButton, ...(activeTab === 'users' ? styles.tabButtonActive : {}) }} onClick={() => setActiveTab('users')}>
          Users
        </button>
        <button
          type="button"
          style={{ ...styles.tabButton, ...(activeTab === 'role-permissions' ? styles.tabButtonActive : {}) }}
          onClick={() => setActiveTab('role-permissions')}
        >
          Role Permission
        </button>
      </div>

      {activeTab === 'users' ? (
        <section style={styles.section}>
          <div>
            <h2 style={styles.sectionTitle}>Users</h2>
            <p style={styles.sectionSubtitle}>Edit display name, assign role, dan kirim invite dari tab ini.</p>
          </div>

          <input type="search" aria-label="Search users" placeholder="Search name, email, or role..." value={userSearch} onChange={(event) => setUserSearch(event.target.value)} style={{ ...styles.input, maxWidth: 400 }} />
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.headRow}>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Display Name</th>
                  <th style={styles.th}>Access</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.map((profile) => (
                  <tr key={profile.id || profile.email} style={styles.bodyRow}>
                    <td style={styles.td}>{profile.email || '-'}</td>
                    <td style={styles.td}>
                      <form id={`access-form-${profile.id}`} action={updateUserRole} style={styles.inlineForm}>
                        <input type="hidden" name="profile_id" value={profile.id || ''} />
                        <input name="display_name" defaultValue={profile.display_name || ''} style={styles.input} placeholder="Display name" />
                      </form>
                    </td>
                    <td style={styles.td}>
                      <span
                        style={
                          Object.prototype.hasOwnProperty.call(profile, 'authenticated_id')
                            ? profile.authenticated_id
                              ? styles.linkedBadge
                              : styles.unlinkedBadge
                            : styles.linkedBadge
                        }
                      >
                        {Object.prototype.hasOwnProperty.call(profile, 'authenticated_id')
                          ? profile.authenticated_id
                            ? 'Linked'
                            : 'Not linked'
                          : 'Linked'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <select name="role" form={`access-form-${profile.id}`} defaultValue={profile.role || 'guest'} style={styles.select}>
                        {roleOptions.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.actionStack}>
                        <button type="submit" form={`access-form-${profile.id}`} style={styles.primaryButton}>
                          Save
                        </button>
                        <form action={sendUserInvite} style={styles.inviteForm}>
                          <input type="hidden" name="profile_id" value={profile.id || ''} />
                          <input type="hidden" name="email" value={profile.email || ''} />
                          <input type="hidden" name="display_name" value={profile.display_name || ''} />
                          <button
                            type="submit"
                            style={styles.secondaryButton}
                            disabled={!profile.email || Boolean(profile.authenticated_id)}
                            title={
                              !profile.email
                                ? 'Profile needs an email before invite can be sent.'
                                : profile.authenticated_id
                                  ? 'This profile is already linked to an auth account.'
                                  : 'Send invitation email'
                            }
                          >
                            Send Invite
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredProfiles.length ? <tr><td colSpan={5} style={styles.td}>No matching users.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <RolePermissionEditor key={JSON.stringify(rolePermissionMap)} roleOptions={roleOptions} permissionCatalog={permissionCatalog} rolePermissionMap={rolePermissionMap} action={updateRolePermissions} />
      )}
    </div>
  )
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  title: {
    margin: 0,
    fontSize: '28px',
  },
  subtitle: {
    color: '#6b7280',
    margin: '4px 0 0',
  },
  tabRow: {
    display: 'flex',
    gap: '8px',
  },
  tabButton: {
    minHeight: '38px',
    padding: '0 14px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d1d5db',
    borderRadius: '999px',
    background: '#fff',
    color: '#111827',
    fontWeight: '700',
    cursor: 'pointer',
  },
  tabButtonActive: {
    background: '#111827',
    color: '#fff',
    borderColor: '#111827',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
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
  tableWrap: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    overflowX: 'auto',
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
  secondaryButton: {
    padding: '9px 14px',
    background: '#ffffff',
    color: '#111827',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontWeight: '600',
    cursor: 'pointer',
    minWidth: '104px',
  },
  actionStack: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  inviteForm: {
    margin: 0,
  },
  linkedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '30px',
    padding: '0 12px',
    borderRadius: '999px',
    background: '#dcfce7',
    color: '#166534',
    fontSize: '12px',
    fontWeight: '700',
  },
  unlinkedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '30px',
    padding: '0 12px',
    borderRadius: '999px',
    background: '#fef3c7',
    color: '#92400e',
    fontSize: '12px',
    fontWeight: '700',
  },
  rolePermissionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  rolePickerWrap: {
    minWidth: '220px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  pickerLabel: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#374151',
  },
  rolePermissionCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '14px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  roleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  roleTitle: {
    margin: 0,
    fontSize: '16px',
    color: '#111827',
  },
  roleSubtitle: {
    margin: '2px 0 0',
    color: '#6b7280',
    fontSize: '12px',
  },
  roleHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  roleCountBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '28px',
    padding: '0 10px',
    borderRadius: '999px',
    background: '#f3f4f6',
    color: '#374151',
    fontSize: '12px',
    fontWeight: '700',
  },
  microButton: {
    minHeight: '28px',
    padding: '0 10px',
    border: '1px solid #d1d5db',
    borderRadius: '999px',
    background: '#fff',
    color: '#374151',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  permissionGroup: {
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    overflow: 'hidden',
    background: '#fcfcfd',
  },
  groupHeaderButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    border: 'none',
    background: '#f8fafc',
    textAlign: 'left',
    cursor: 'pointer',
  },
  groupBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '8px 10px',
  },
  permissionGroupTitle: {
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#475569',
  },
  permissionGroupCount: {
    marginLeft: 'auto',
    fontSize: '11px',
    fontWeight: '700',
    color: '#94a3b8',
  },
  treeBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  treeBranchButton: {
    width: '100%',
    minHeight: '30px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    border: 'none',
    background: 'transparent',
    color: '#111827',
    fontWeight: '700',
    fontSize: '13px',
    textAlign: 'left',
    cursor: 'pointer',
  },
  treeChildren: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  treeChevron: {
    width: '14px',
    display: 'inline-flex',
    justifyContent: 'center',
    color: '#64748b',
    flexShrink: 0,
  },
  treeLeaf: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '6px 0',
    borderTop: '1px solid #f1f5f9',
  },
  branchPermissionRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '2px 0 4px',
  },
  treeLeafMain: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 1fr) minmax(360px, 1.1fr)',
    gap: '12px',
    alignItems: 'start',
  },
  visibilityOnlyLeafMain: {
    gridTemplateColumns: 'minmax(220px, 1fr)',
  },
  permissionText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  permissionLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#111827',
  },
  permissionMeta: {
    fontSize: '11px',
    color: '#6b7280',
    lineHeight: 1.35,
  },
  actionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(64px, 1fr))',
    gap: '6px',
  },
  actionCheckbox: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    minHeight: '28px',
    padding: '0 8px',
    border: '1px solid #e5e7eb',
    borderRadius: '999px',
    background: '#fff',
    fontSize: '11px',
    color: '#111827',
  },
  actionCheckboxDisabled: {
    background: '#f8fafc',
    borderColor: '#e5e7eb',
    color: '#94a3b8',
    opacity: 0.9,
    cursor: 'not-allowed',
  },
  specialActionStack: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  specialActionLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    minHeight: '28px',
    padding: '0 8px',
    border: '1px solid #e5e7eb',
    borderRadius: '999px',
    background: '#fff',
    fontSize: '11px',
    color: '#111827',
  },
  successBanner: {
    margin: 0,
    color: '#166534',
    fontSize: '13px',
    lineHeight: 1.5,
    background: '#f0fdf4',
    borderRadius: '12px',
    padding: '12px 14px',
    border: '1px solid #bbf7d0',
  },
  errorBanner: {
    margin: 0,
    color: '#b91c1c',
    fontSize: '13px',
    lineHeight: 1.5,
    background: '#fef2f2',
    borderRadius: '12px',
    padding: '12px 14px',
    border: '1px solid #fecaca',
  },
}
