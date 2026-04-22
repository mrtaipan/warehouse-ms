'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/browser'

const supabase = createClient()

function buildTree(categories) {
  const byId = new Map(categories.map((item) => [item.id, { ...item, children: [] }]))
  const roots = []

  for (const item of byId.values()) {
    if (item.parent_id && byId.has(item.parent_id)) {
      byId.get(item.parent_id).children.push(item)
    } else {
      roots.push(item)
    }
  }

  const sortNodes = (nodes) => {
    nodes.sort((a, b) => (a.full_code || a.category_code || '').localeCompare(b.full_code || b.category_code || ''))
    nodes.forEach((node) => sortNodes(node.children))
  }

  sortNodes(roots)
  return roots
}

function collectExpandedIds(nodes, ids = {}) {
  for (const node of nodes) {
    ids[node.id] = true
    collectExpandedIds(node.children, ids)
  }
  return ids
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState([])
  const [expanded, setExpanded] = useState({})
  const [openMenuId, setOpenMenuId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadCategories() {
      setLoading(true)
      setError('')

      const { data, error } = await supabase
        .from('categories')
        .select('id, category_code, category_name, parent_id, level, full_code, full_name, is_active')
        .order('id', { ascending: true })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      const rows = data || []
      setCategories(rows)
      setExpanded(collectExpandedIds(buildTree(rows)))
      setLoading(false)
    }

    loadCategories()
  }, [])

  const tree = useMemo(() => buildTree(categories), [categories])

  async function handleToggleActive(categoryId, nextActiveValue) {
    setError('')

    const { error } = await supabase
      .from('categories')
      .update({ is_active: nextActiveValue })
      .eq('id', categoryId)

    if (error) {
      setError(error.message)
      return
    }

    setCategories((prev) =>
      prev.map((item) =>
        item.id === categoryId ? { ...item, is_active: nextActiveValue } : item
      )
    )
  }

  function toggleExpand(nodeId) {
    setExpanded((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }))
  }

  function toggleMenu(nodeId) {
    setOpenMenuId((prev) => (prev === nodeId ? null : nodeId))
  }

  function renderNode(node, depth = 0) {
    const hasChildren = node.children.length > 0
    const isExpanded = expanded[node.id]
    const uiLevel = Number(node.level) - 1
    const isMenuOpen = openMenuId === node.id

    return (
      <div key={node.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ ...styles.nodeRow, marginLeft: `${depth * 28}px` }}>
          <div style={styles.nodeMain}>
            <button
              type="button"
              onClick={() => hasChildren ? toggleExpand(node.id) : null}
              style={{
                ...styles.expandButton,
                visibility: hasChildren ? 'visible' : 'hidden',
              }}
            >
              {isExpanded ? '-' : '+'}
            </button>

            <div style={styles.nodeContent}>
              <div style={styles.nodeMeta}>
                <span style={styles.levelBadge}>Level {uiLevel}</span>
                <span style={styles.codeBadge}>{node.category_code}</span>
              </div>
              <strong style={styles.nodeTitle}>{node.category_name}</strong>
              <span style={styles.nodePath}>{node.full_name || node.category_name}</span>
            </div>
          </div>

          <div style={styles.nodeActions}>
            <label style={styles.switchWrap}>
              <span style={styles.switchText}>Active</span>
              <button
                type="button"
                onClick={() => handleToggleActive(node.id, !node.is_active)}
                style={styles.toggleButton}
              >
                <span
                  style={{
                    ...styles.toggleTrack,
                    backgroundColor: node.is_active ? '#22c55e' : '#cbd5e1',
                  }}
                >
                  <span
                    style={{
                      ...styles.toggleThumb,
                      transform: node.is_active ? 'translateX(20px)' : 'translateX(0)',
                    }}
                  />
                </span>
              </button>
            </label>

            <Link href={`/dashboard/categories/${node.id}`} style={styles.editButton}>
              Edit
            </Link>

            <div style={styles.menuWrap}>
              <button
                type="button"
                onClick={() => toggleMenu(node.id)}
                style={styles.primaryActionButton}
              >
                + Add
              </button>

              {isMenuOpen ? (
                <div style={styles.menuCard}>
                  <Link
                    href={`/dashboard/categories/new?mode=sibling&fromId=${node.id}`}
                    style={styles.menuLink}
                    onClick={() => setOpenMenuId(null)}
                  >
                    Add same level
                  </Link>

                  {uiLevel < 2 ? (
                    <Link
                      href={`/dashboard/categories/new?mode=child&fromId=${node.id}`}
                      style={styles.menuLink}
                      onClick={() => setOpenMenuId(null)}
                    >
                      Add child level
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {hasChildren && isExpanded ? (
          <div style={styles.childrenWrap}>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Categories</h1>
          <p style={styles.subtitle}>Structured product categories in Level 0, Level 1, and Level 2.</p>
        </div>

        <Link href="/dashboard/categories/new?mode=root" style={styles.addButton}>
          + Add Level 0
        </Link>
      </div>

      {loading ? <p style={styles.loading}>Loading categories...</p> : null}
      {error ? <p style={styles.error}>{error}</p> : null}

      {!loading && tree.length === 0 ? (
        <div style={styles.emptyBox}>
          <p style={{ margin: 0 }}>No categories yet.</p>
        </div>
      ) : null}

      {!loading && tree.length > 0 ? (
        <div style={styles.treeCard}>
          {tree.map((node) => renderNode(node))}
        </div>
      ) : null}
    </div>
  )
}

const styles = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: '20px' },
  header: { display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' },
  title: { marginTop: 0, marginBottom: '8px', fontSize: '28px' },
  subtitle: { marginTop: 0, marginBottom: 0, color: '#6b7280' },
  addButton: { display: 'inline-flex', alignItems: 'center', padding: '10px 14px', background: '#111827', color: '#fff', textDecoration: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600' },
  loading: { color: '#6b7280' },
  error: { color: '#dc2626', margin: 0 },
  emptyBox: { background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e5e7eb' },
  treeCard: { background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' },
  nodeRow: { display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '14px 16px', borderRadius: '12px', border: '1px solid #e5e7eb', background: '#fff', alignItems: 'center', flexWrap: 'wrap' },
  nodeMain: { display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: '320px', flex: 1 },
  expandButton: { width: '28px', height: '28px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '18px', lineHeight: 1 },
  nodeContent: { display: 'flex', flexDirection: 'column', gap: '6px' },
  nodeMeta: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  levelBadge: { display: 'inline-flex', padding: '4px 8px', borderRadius: '999px', background: '#dbeafe', color: '#1d4ed8', fontSize: '12px', fontWeight: '700' },
  codeBadge: { display: 'inline-flex', padding: '4px 8px', borderRadius: '999px', background: '#f3f4f6', color: '#111827', fontSize: '12px', fontWeight: '700' },
  nodeTitle: { fontSize: '16px', color: '#111827' },
  nodePath: { fontSize: '13px', color: '#6b7280' },
  nodeActions: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' },
  switchWrap: { display: 'inline-flex', alignItems: 'center', gap: '8px' },
  switchText: { fontSize: '13px', color: '#6b7280', fontWeight: '600' },
  toggleButton: { padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' },
  toggleTrack: { width: '44px', height: '24px', borderRadius: '999px', padding: '2px', display: 'flex', alignItems: 'center' },
  toggleThumb: { width: '20px', height: '20px', borderRadius: '999px', background: '#fff', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)', transition: 'transform 0.2s ease' },
  editButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '36px', padding: '0 12px', background: '#2563eb', color: '#fff', textDecoration: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600' },
  primaryActionButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '36px', padding: '0 12px', background: '#111827', color: '#fff', borderRadius: '8px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer' },
  childrenWrap: { display: 'flex', flexDirection: 'column', gap: '12px' },
  menuWrap: { position: 'relative' },
  menuCard: { position: 'absolute', top: '42px', right: 0, minWidth: '170px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)', padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 10 },
  menuLink: { display: 'flex', alignItems: 'center', minHeight: '36px', padding: '0 10px', borderRadius: '8px', color: '#111827', textDecoration: 'none', fontSize: '13px', fontWeight: '600', background: '#fff' },
}
