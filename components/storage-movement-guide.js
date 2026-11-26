'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import styles from './storage-location-guide.module.css'

const MOVEMENTS = [
  ['STORE_QUEUE', 'Barang dari Storage Queue disimpan ke pallet atau shelving.'],
  ['MOVE', 'Barang dipindahkan dari satu lokasi penyimpanan ke lokasi lain.'],
  ['TAKE_OUT', 'Barang dikeluarkan dari stok gudang secara manual.'],
  ['TEMPORARY_IN', 'Barang dipindahkan dari gudang ke area sementara.'],
  ['TEMPORARY_RETURN', 'Barang dari area sementara disimpan kembali ke gudang.'],
  ['TEMPORARY_ADJUSTMENT_IN', 'Jumlah di Temp. Sales Area bertambah setelah penyesuaian fisik.'],
  ['TEMPORARY_ADJUSTMENT_OUT', 'Jumlah di Temp. Sales Area berkurang setelah penyesuaian fisik.'],
  ['PUTAWAY_IN', 'Barang dari Shelving Queue ditempatkan ke shelving.'],
  ['RESTOCK_OUT', 'Barang diambil dari lokasi penyimpanan untuk restock picker.'],
  ['RESTOCK_REVERSE_IN', 'Pengambilan restock dibatalkan dan stok dikembalikan ke lokasi asal.'],
  ['CUSTOMER_RETURN_IN', 'Barang retur pelanggan diterima kembali ke stok.'],
  ['CUSTOMER_REPLACEMENT_OUT', 'Barang pengganti untuk pelanggan dikeluarkan dari stok.'],
  ['QC_RECHECK_OUT', 'Barang dikeluarkan dari penyimpanan untuk pemeriksaan ulang QC.'],
  ['REJECT_OUT', 'Barang dikeluarkan dari stok untuk didaftarkan sebagai reject.'],
  ['LOAN_OUT', 'Barang dikeluarkan dari stok untuk dipinjam.'],
  ['LOAN_RETURN', 'Barang pinjaman diterima kembali ke stok.'],
]

export default function StorageMovementGuide({ onClose }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return createPortal(
    <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="storage-movement-guide-title">
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>PANDUAN STORAGE HISTORY</p>
            <h2 id="storage-movement-guide-title">Jenis Movement</h2>
            <p className={styles.intro}>Arti perpindahan barang yang tercatat di Movement History.</p>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Tutup panduan movement" title="Tutup">&times;</button>
        </div>
        <div className={styles.list}>
          {MOVEMENTS.map(([type, description], index) => (
            <div className={styles.row} key={type}>
              <span className={styles.index}>{String(index + 1).padStart(2, '0')}</span>
              <h3>{type.replaceAll('_', ' ')}</h3>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
