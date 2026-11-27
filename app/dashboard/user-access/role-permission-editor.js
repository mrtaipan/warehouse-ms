'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { ChevronDown, ChevronRight, Search, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { DASHBOARD_SHORTCUT_CONFIGURED_CODE } from '@/utils/permissions'
import { DELIVERY_ACCESS_CONFIGURED } from '@/utils/delivery-access.mjs'
import css from './user-access.module.css'

const title = (value) => ({ location: 'Storage Location', history: 'Storage History', queue_area: 'Queue Area', temp_area: 'Temp Area' }[value] || value.split('_').map((word) => word[0]?.toUpperCase() + word.slice(1)).join(' '))

function tree(group) {
  const roots = []
  for (const item of group.items) {
    let level = roots
    let path = group.key
    const parts = item.key.split('.')
    parts.forEach((part, index) => {
      path += `.${part}`
      let node = level.find((candidate) => candidate.id === path)
      if (!node) { node = { id: path, label: title(part), children: [] }; level.push(node) }
      if (index === parts.length - 1) { node.item = item; node.label = item.label }
      level = node.children
    })
  }
  return roots
}

function filterTree(nodes, query) {
  if (!query) return nodes
  return nodes.flatMap((node) => {
    if (`${node.label} ${node.item?.description || ''}`.toLowerCase().includes(query)) return [node]
    const children = filterTree(node.children, query)
    return children.length ? [{ ...node, children }] : []
  })
}

function Node({ node, expanded, setExpanded, searching, selected, toggle }) {
  const branch = node.children.length > 0
  const open = searching || expanded[node.id] === true
  return <div className={css.node}>
    <div className={css.permissionRow}>
      <div className={css.permissionIdentity}>
        {branch ? <button type="button" className={css.chevron} aria-label={`${open ? 'Collapse' : 'Expand'} ${node.label}`} aria-expanded={open} onClick={() => setExpanded((current) => ({ ...current, [node.id]: !open }))}>{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button> : <span className={css.leafMark} />}
        <div><span className={branch ? css.branchTitle : css.leafTitle}>{node.label}</span>{node.item?.description ? <p className={css.description}>{node.item.description}</p> : null}</div>
      </div>
      <div className={css.actions}>
        {(node.item?.actions || []).map((action) => <label key={action.code} className={css.permissionToggle} data-checked={selected.has(action.code)}>
          <input type="checkbox" checked={selected.has(action.code)} onChange={(event) => toggle(action.code, action.key, event.target.checked)} aria-label={`${node.label}: ${action.label}`} />{action.label}
        </label>)}
      </div>
    </div>
    {branch && open ? <div className={css.children}>{node.children.map((child) => <Node key={child.id} node={child} expanded={expanded} setExpanded={setExpanded} searching={searching} selected={selected} toggle={toggle} />)}</div> : null}
  </div>
}

function SaveButton() {
  const { pending } = useFormStatus()
  return <button type="submit" className={css.save} disabled={pending}><ShieldCheck size={16} />{pending ? 'Saving...' : 'Save permissions'}</button>
}

export default function RolePermissionEditor({ roleOptions, permissionCatalog, rolePermissionMap, action }) {
  const roles = roleOptions.filter((role) => role.value !== 'admin')
  const known = new Set(permissionCatalog.flatMap((group) => group.items.flatMap((item) => item.actions.map((a) => a.code))))
  const baseline = Object.fromEntries(roles.map(({ value }) => [value, (rolePermissionMap[value] || []).filter((code) => known.has(code))]))
  const [role, setRole] = useState(roles[0]?.value || 'guest')
  const [selections, setSelections] = useState(() => Object.fromEntries(Object.entries(baseline).map(([key, codes]) => [key, new Set(codes)])))
  const [moduleKey, setModuleKey] = useState('dashboard')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState({})
  const groups = permissionCatalog.map((group) => ({ ...group, items: group.items.filter((item) => !item.visibilityOnly) }))
  groups.push({ key: 'shortcuts', label: 'Dashboard Shortcuts', items: permissionCatalog.flatMap((group) => group.items.filter((item) => item.visibilityOnly).map((item) => ({ ...item, key: item.key.replace(/^shortcuts\./, '') }))) })
  const search = query.trim().toLowerCase()
  const selected = selections[role] || new Set()
  const group = groups.find((item) => item.key === moduleKey) || groups[0]
  const nodes = filterTree(tree(group), search)
  const dirty = selected.size !== baseline[role]?.length || (baseline[role] || []).some((code) => !selected.has(code))

  function toggle(code, actionKey, checked) {
    setSelections((current) => {
      const next = new Set(current[role] || [])
      const prefix = code.replace(/\.[^.]+$/, '')
      const independent = ['inbound.receiving', 'inbound.unload'].includes(prefix)
      if (checked) {
        next.add(code)
        if (['add', 'edit', 'delete', 'print', 'export', 'submit', 'assign'].includes(actionKey) && !independent) next.add(`${prefix}.view`)
        if (code.startsWith('delivery_report.') && code !== 'delivery_report.view') {
          next.add('delivery_report.view')
          if (code.startsWith('delivery_report.summary.')) next.add('delivery_report.summary.view')
        }
      } else {
        next.delete(code)
        if (actionKey === 'view' && !independent) for (const existing of next) if (existing.startsWith(`${prefix}.`)) next.delete(existing)
      }
      return { ...current, [role]: next }
    })
  }

  function expandAll(value) {
    const collect = (items, result = {}) => { for (const node of items) { if (node.children.length) result[node.id] = value; collect(node.children, result) } return result }
    setExpanded((current) => ({ ...current, ...collect(tree(group)) }))
  }

  return <form action={action} className={css.editor}>
    <input type="hidden" name="role" value={role} />
    {[...selected, DASHBOARD_SHORTCUT_CONFIGURED_CODE, DELIVERY_ACCESS_CONFIGURED].map((code) => <input key={code} type="hidden" name="permission_code" value={code} />)}
    <header className={css.toolbar}>
      <label className={css.rolePicker}><span>Editing role</span><select value={role} onChange={(event) => setRole(event.target.value)}>{roles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <div className={css.saveArea}><span role="status" className={dirty ? css.unsaved : css.saved}>{dirty ? 'Unsaved changes' : 'No unsaved changes'}</span>{dirty ? <button type="button" className={css.secondary} onClick={() => setSelections((current) => ({ ...current, [role]: new Set(baseline[role] || []) }))}>Reset draft</button> : null}<SaveButton /></div>
    </header>
    <div className={css.workspace}>
      <aside className={css.sidebar}>
        <span className={css.eyebrow}>Modules</span>
        <nav aria-label="Permission modules">{groups.map((item) => {
          const codes = item.items.flatMap((entry) => entry.actions.map((a) => a.code))
          return <button key={item.key} type="button" aria-current={moduleKey === item.key ? 'page' : undefined} className={css.moduleButton} onClick={() => setModuleKey(item.key)}><span>{item.label}</span><small>{codes.filter((code) => selected.has(code)).length}/{codes.length}</small></button>
        })}</nav>
        <p className={css.sidebarNote}>Admin retains full access. Role settings do not change existing group restrictions.</p>
      </aside>
      <section className={css.content}>
        <div className={css.moduleHeader}><div><span className={css.eyebrow}>{group.key === 'shortcuts' ? 'Dashboard buttons' : 'Module permissions'}</span><h2>{group.label}</h2><p>{group.key === 'shortcuts' ? 'Atur tombol di dashboard. Ini terpisah dari rincian izin halaman.' : 'Atur akses halaman dan bagian di dalamnya. Buka panah untuk melihat subbagian.'}</p></div><SlidersHorizontal size={20} /></div>
        <div className={css.filterBar}><label className={css.search}><Search size={16} /><input type="search" aria-label="Search permissions in this module" placeholder="Search within this module..." value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className={css.treeTools}><button type="button" disabled={Boolean(search)} onClick={() => expandAll(true)}>Expand all</button><button type="button" disabled={Boolean(search)} onClick={() => expandAll(false)}>Collapse all</button></div></div>
        <div className={css.tree}>{nodes.length ? nodes.map((node) => <Node key={node.id} node={node} expanded={expanded} setExpanded={setExpanded} searching={Boolean(search)} selected={selected} toggle={toggle} />) : <p className={css.empty}>No matching permissions in this module.</p>}</div>
      </section>
    </div>
  </form>
}
