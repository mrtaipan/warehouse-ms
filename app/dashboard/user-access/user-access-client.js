'use client'

import { useMemo, useState } from 'react'

function buildRolePermissionState(rolePermissionMap, knownPermissionCodes) {
  const knownCodeSet = new Set(knownPermissionCodes || [])
  return Object.fromEntries(
    Object.entries(rolePermissionMap || {}).map(([role, codes]) => [
      role,
      new Set((codes || []).filter((code) => knownCodeSet.has(code))),
    ])
  )
}

function titleizeSegment(value) {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function buildTreeItems(items) {
  const root = []

  for (const [itemIndex, item] of (items || []).entries()) {
    const segments = String(item.key || '')
      .split('.')
      .filter(Boolean)

    if (!segments.length) continue

    let level = root
    let prefix = ''

    segments.forEach((segment, index) => {
      const isLast = index === segments.length - 1
      prefix = prefix ? `${prefix}.${segment}` : segment

      let node = level.find((candidate) => candidate.segment === segment)

      if (!node) {
        node = {
          id: isLast ? `leaf:${prefix}` : `branch:${prefix}`,
          segment,
          label: isLast ? item.label : titleizeSegment(segment),
          kind: isLast ? 'leaf' : 'branch',
          children: [],
          item: null,
          order: itemIndex,
        }
        level.push(node)
      }

      if (isLast) {
        node.item = item
        node.label = item.label
        node.kind = node.children.length ? 'branch' : 'leaf'
        node.id = `${node.kind}:${prefix}`
        node.order = Math.min(node.order ?? itemIndex, itemIndex)
      } else {
        if (node.kind === 'leaf') {
          node.kind = 'branch'
          node.id = `branch:${prefix}`
        }
        node.order = Math.min(node.order ?? itemIndex, itemIndex)
        level = node.children
      }
    })
  }

  return root
}

function normalizeActionLabel(value) {
  if (value === 'view') return 'View'
  if (value === 'add') return 'Add'
  if (value === 'edit') return 'Edit'
  if (value === 'delete') return 'Delete'
  if (value === 'print') return 'Print'
  if (value === 'export') return 'Export'
  if (value === 'submit') return 'Submit'
  if (value === 'assign') return 'Assign'
  return value
}

function sortTreeNodes(nodes) {
  return [...(nodes || [])].sort((left, right) => {
    const leftOrder = Number.isFinite(left.order) ? left.order : Number.MAX_SAFE_INTEGER
    const rightOrder = Number.isFinite(right.order) ? right.order : Number.MAX_SAFE_INTEGER

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }

    if (left.kind !== right.kind) {
      return left.kind === 'branch' ? -1 : 1
    }
    return left.label.localeCompare(right.label)
  })
}

function collectExpandableIds(nodes, bucket = []) {
  for (const node of nodes || []) {
    if (node.kind === 'branch') {
      bucket.push(node.id)
      collectExpandableIds(node.children, bucket)
    }
  }

  return bucket
}

function PermissionActions({
  item,
  paddingLeft,
  selectedPermissions,
  onPermissionToggle,
  hideLabel = false,
  compact = false,
}) {
  const actionsByKey = Object.fromEntries((item?.actions || []).map((action) => [action.key, action]))
  const standardActions = ['view', 'add', 'edit', 'delete']
  const specialActions = (item?.actions || []).filter((action) => !standardActions.includes(action.key))

  return (
    <div style={compact ? styles.branchPermissionRow : styles.treeLeaf}>
      <div style={styles.treeLeafMain}>
        <div style={{ ...styles.permissionText, paddingLeft }}>
          {!hideLabel ? <span style={styles.permissionLabel}>{item?.label}</span> : null}
          <span style={styles.permissionMeta}>{item?.description || 'No description yet.'}</span>
        </div>
        <div style={styles.actionGrid}>
          {standardActions.map((actionKey) => {
            const action = actionsByKey[actionKey]
            if (!action) {
              return (
                <label key={actionKey} style={{ ...styles.actionCheckbox, ...styles.actionCheckboxDisabled }}>
                  <input type="checkbox" disabled />
                  <span>{normalizeActionLabel(actionKey)}</span>
                </label>
              )
            }

            return (
              <label key={action.code} style={styles.actionCheckbox}>
                <input
                  type="checkbox"
                  checked={selectedPermissions.has(action.code)}
                  onChange={(event) => onPermissionToggle(action.code, actionKey, event.target.checked)}
                />
                <span>{normalizeActionLabel(actionKey)}</span>
              </label>
            )
          })}
        </div>
      </div>

      {specialActions.length ? (
        <div style={{ ...styles.specialActionStack, paddingLeft: paddingLeft + 10 }}>
          {specialActions.map((action) => (
            <label key={action.code} style={styles.specialActionLabel}>
              <input
                type="checkbox"
                checked={selectedPermissions.has(action.code)}
                onChange={(event) => onPermissionToggle(action.code, action.key, event.target.checked)}
              />
              <span>{action.label}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function TreeNode({
  node,
  depth,
  expandedMap,
  onToggle,
  selectedPermissions,
  onPermissionToggle,
}) {
  const paddingLeft = 8 + depth * 14
  const isBranch = node.kind === 'branch'
  const isExpanded = expandedMap[node.id] ?? false

  if (isBranch) {
    return (
      <div style={styles.treeBlock}>
        <button type="button" style={{ ...styles.treeBranchButton, paddingLeft }} onClick={() => onToggle(node.id)}>
          <span style={styles.treeChevron}>{isExpanded ? '-' : '+'}</span>
          <span>{node.label}</span>
        </button>

        {node.item ? (
          <PermissionActions
            item={node.item}
            paddingLeft={paddingLeft + 20}
            selectedPermissions={selectedPermissions}
            onPermissionToggle={onPermissionToggle}
            hideLabel
            compact
          />
        ) : null}

        {isExpanded ? (
          <div style={styles.treeChildren}>
            {sortTreeNodes(node.children).map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                expandedMap={expandedMap}
                onToggle={onToggle}
                selectedPermissions={selectedPermissions}
                onPermissionToggle={onPermissionToggle}
              />
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <PermissionActions
      item={node.item}
      paddingLeft={paddingLeft}
      selectedPermissions={selectedPermissions}
      onPermissionToggle={onPermissionToggle}
    />
  )
}

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
  const editableRoles = roleOptions.filter((role) => role.value !== 'admin')
  const knownPermissionCodes = useMemo(
    () =>
      (permissionCatalog || []).flatMap((group) =>
        (group.items || []).flatMap((item) => (item.actions || []).map((action) => action.code))
      ),
    [permissionCatalog]
  )
  const [activeTab, setActiveTab] = useState('users')
  const [selectedRole, setSelectedRole] = useState(editableRoles[0]?.value || 'guest')
  const [roleSelections, setRoleSelections] = useState(() => buildRolePermissionState(rolePermissionMap, knownPermissionCodes))
  const [expandedMap, setExpandedMap] = useState({})

  const selectedPermissions = roleSelections[selectedRole] || new Set()
  const selectedRoleLabel = editableRoles.find((role) => role.value === selectedRole)?.label || selectedRole

  const treeGroups = useMemo(
    () =>
      (permissionCatalog || []).map((group) => ({
        ...group,
        treeItems: buildTreeItems(group.items),
      })),
    [permissionCatalog]
  )

  function toggleBranch(id) {
    setExpandedMap((current) => ({
      ...current,
      [id]: !(current[id] ?? false),
    }))
  }

  function expandAllForCurrentRole() {
    const nextExpanded = {}

    for (const group of treeGroups) {
      nextExpanded[`group:${group.key}`] = true
      collectExpandableIds(group.treeItems).forEach((id) => {
        nextExpanded[id] = true
      })
    }

    setExpandedMap(nextExpanded)
  }

  function collapseAllForCurrentRole() {
    setExpandedMap({})
  }

  function togglePermission(code, actionKey, checked) {
    setRoleSelections((current) => {
      const nextSet = new Set(current[selectedRole] || [])

      if (checked) {
        nextSet.add(code)
        if (['add', 'edit', 'delete', 'print', 'export', 'submit', 'assign'].includes(actionKey)) {
          nextSet.add(code.replace(/\.[^.]+$/, '.view'))
        }
      } else {
        nextSet.delete(code)
        if (actionKey === 'view') {
          const prefix = code.replace(/\.view$/, '')
          for (const existingCode of Array.from(nextSet)) {
            if (existingCode.startsWith(`${prefix}.`) && existingCode !== code) {
              nextSet.delete(existingCode)
            }
          }
        }
      }

      return {
        ...current,
        [selectedRole]: nextSet,
      }
    })
  }

  return (
    <div style={styles.wrapper}>
      <div>
        <h1 style={styles.title}>User Access</h1>
        <p style={styles.subtitle}>Kelola role user dan matrix permission dari satu tempat.</p>
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
                {(profiles || []).map((profile) => (
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
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section style={styles.section}>
          <div style={styles.rolePermissionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Role Permission</h2>
              <p style={styles.sectionSubtitle}>Pilih satu role dulu, lalu edit hak aksesnya dengan tampilan tree.</p>
            </div>

            <div style={styles.rolePickerWrap}>
              <label style={styles.pickerLabel}>Role</label>
              <select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)} style={styles.select}>
                {editableRoles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <form action={updateRolePermissions} style={styles.rolePermissionCard}>
            <input type="hidden" name="role" value={selectedRole} />
            {Array.from(selectedPermissions).map((code) => (
              <input key={code} type="hidden" name="permission_code" value={code} />
            ))}

            <div style={styles.roleHeader}>
              <div>
                <h3 style={styles.roleTitle}>{selectedRoleLabel}</h3>
                <p style={styles.roleSubtitle}>{selectedRole}</p>
              </div>
              <div style={styles.roleHeaderActions}>
                <span style={styles.roleCountBadge}>{selectedPermissions.size} active</span>
                <button type="button" style={styles.microButton} onClick={expandAllForCurrentRole}>
                  Expand all
                </button>
                <button type="button" style={styles.microButton} onClick={collapseAllForCurrentRole}>
                  Collapse all
                </button>
                <button type="submit" style={styles.primaryButton}>
                  Save Permission
                </button>
              </div>
            </div>

            {treeGroups.map((group) => (
              <div key={group.key} style={styles.permissionGroup}>
                <button type="button" style={styles.groupHeaderButton} onClick={() => toggleBranch(`group:${group.key}`)}>
                  <span style={styles.treeChevron}>{expandedMap[`group:${group.key}`] ?? false ? '-' : '+'}</span>
                  <strong style={styles.permissionGroupTitle}>{group.label}</strong>
                  <span style={styles.permissionGroupCount}>{group.items.length} items</span>
                </button>

                {expandedMap[`group:${group.key}`] ?? false ? (
                  <div style={styles.groupBody}>
                    {sortTreeNodes(group.treeItems).map((node) => (
                      <TreeNode
                        key={node.id}
                        node={node}
                        depth={0}
                        expandedMap={expandedMap}
                        onToggle={toggleBranch}
                        selectedPermissions={selectedPermissions}
                        onPermissionToggle={togglePermission}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </form>
        </section>
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
