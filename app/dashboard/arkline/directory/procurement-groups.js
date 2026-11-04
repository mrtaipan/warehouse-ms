'use client'

import { useState } from 'react'
import styles from '../arkline.module.css'
import groupStyles from './procurement-groups.module.css'

function itemTypeLabel(category, productCategory) {
  const name = String(category?.category_name || '').toUpperCase()
  if (name === 'SHORT SLEEVE') return `${productCategory} SS`
  if (name === 'LONG SLEEVE') return `${productCategory} LS`
  if (name === productCategory) return name
  if (name.startsWith(`${productCategory} `)) return name
  return `${productCategory} ${name}`.trim()
}

function skuCount(count) {
  return `${count} SKU${count === 1 ? '' : 's'}`
}

function buildGroups(products, allProducts, procurementCategories, categoryTree, filtering) {
  const categoryById = new Map(categoryTree.map((category) => [String(category.id), category]))
  const groups = new Map()

  for (const procurement of procurementCategories) {
    const matchingProducts = products.filter((product) => product.kategori_pengadaan === procurement.category_name)
    if (filtering && !matchingProducts.length) continue

    const itemType = categoryById.get(String(procurement.category_id))
    const parent = categoryById.get(String(itemType?.parent_id))
    const productCategory = matchingProducts[0]?.kategori_produk ||
      allProducts.find((product) => product.category_id === String(procurement.category_id))?.kategori_produk ||
      String(parent?.category_name || itemType?.category_name || 'OTHER').toUpperCase()
    const typeName = itemTypeLabel(itemType, productCategory)

    if (!groups.has(productCategory)) groups.set(productCategory, new Map())
    const types = groups.get(productCategory)
    const typeKey = String(procurement.category_id)
    if (!types.has(typeKey)) types.set(typeKey, { name: typeName, categories: [] })
    types.get(typeKey).categories.push({ ...procurement, products: matchingProducts })
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, types]) => ({
      name,
      types: [...types.entries()]
        .sort(([, a], [, b]) => a.name.localeCompare(b.name))
        .map(([id, type]) => ({
          id,
          name: type.name,
          categories: type.categories.sort((a, b) => a.category_name.localeCompare(b.category_name)),
        })),
    }))
}

export default function ProcurementGroups({ products, allProducts, procurementCategories, categoryTree, filtering, onEdit, canEdit }) {
  const [expanded, setExpanded] = useState({})
  const groups = buildGroups(products, allProducts, procurementCategories, categoryTree, filtering)
  const isExpanded = (key) => expanded[key] ?? false
  const toggle = (key) => setExpanded((previous) => ({ ...previous, [key]: !(previous[key] ?? false) }))

  if (!groups.length) return <div className={styles.emptyState}>No procurement categories match the current filters.</div>

  return (
    <div className={groupStyles.tableWrap}>
      <table className={groupStyles.table}>
        <thead><tr><th>Product</th><th>SKU</th><th>Status</th><th>Action</th></tr></thead>
        {groups.map((group) => {
          const groupKey = `category:${group.name}`
          const groupCount = group.types.reduce((total, type) => total + type.categories.reduce((sum, category) => sum + category.products.length, 0), 0)
          return (
            <tbody key={groupKey}>
              <tr className={groupStyles.categoryRow}><td colSpan={4}>
                <button type="button" onClick={() => toggle(groupKey)} aria-expanded={isExpanded(groupKey)}>
                  <span className={groupStyles.chevron}>{isExpanded(groupKey) ? '-' : '+'}</span>
                  <strong>{group.name}</strong><span className={groupStyles.count}>{skuCount(groupCount)}</span>
                </button>
              </td></tr>
              {isExpanded(groupKey) && group.types.map((type) => {
                const typeKey = `type:${group.name}:${type.id}`
                const typeCount = type.categories.reduce((sum, category) => sum + category.products.length, 0)
                return [
                  <tr key={typeKey} className={groupStyles.typeRow}><td colSpan={4}>
                    <button type="button" onClick={() => toggle(typeKey)} aria-expanded={isExpanded(typeKey)}>
                      <span className={groupStyles.chevron}>{isExpanded(typeKey) ? '-' : '+'}</span>
                      <strong>{type.name}</strong><span className={groupStyles.count}>{skuCount(typeCount)}</span>
                    </button>
                  </td></tr>,
                  ...(isExpanded(typeKey) ? type.categories.flatMap((category) => {
                    const procurementKey = `procurement:${category.category_name}`
                    const open = isExpanded(procurementKey)
                    return [
                      <tr key={procurementKey} className={groupStyles.procurementRow}><td colSpan={4}>
                        <button type="button" onClick={() => toggle(procurementKey)} aria-expanded={open}>
                          <span className={groupStyles.chevron}>{open ? '-' : '+'}</span>
                          <span>{category.category_name}</span>
                          {!category.is_active && <span className={groupStyles.inactive}>Inactive</span>}
                          <span className={groupStyles.count}>{skuCount(category.products.length)}</span>
                        </button>
                      </td></tr>,
                      ...(open ? category.products.map((product) => (
                        <tr key={product.sku_induk} className={groupStyles.productRow}>
                          <td><strong>{product.nama_produk}</strong></td>
                          <td className={groupStyles.sku}>{product.sku_induk}</td>
                          <td><span className={product.is_active ? styles.statusActive : styles.statusInactive}>{product.is_active ? 'Active' : 'Inactive'}</span></td>
                          <td><button type="button" className={styles.secondaryButton} onClick={() => onEdit(product)} disabled={!canEdit}>Edit</button></td>
                        </tr>
                      )) : []),
                    ]
                  }) : []),
                ]
              })}
            </tbody>
          )
        })}
      </table>
    </div>
  )
}
