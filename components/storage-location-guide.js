'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import styles from './storage-location-guide.module.css'

const SECTIONS = [
  ['Current Stock', 'Melihat stok yang sudah tersimpan di pallet atau shelving. Dari sini barang dapat dipindahkan, dikeluarkan, atau dikirim ke area sementara.'],
  ['Queueing Area', 'Storage Queue memuat barang dari packing list yang belum ditempatkan. Shelving Queue memuat barang yang menunggu lokasi shelving, misalnya kelebihan restock atau barang retur. Pilih mode untuk melihat antrean dan aksinya masing-masing.'],
  ['Temporary Area', 'Temp. Sales Area menyiapkan barang bagi penjualan dan dapat berkurang melalui upload. Temp. Retur Keeping menyisihkan barang untuk retur atau penggantian dan tidak berkurang melalui upload. Pilih mode untuk melihat stok masing-masing.'],
  ['Product Loans', 'Mencatat peminjaman barang untuk keperluan seperti foto atau konten, mulai dari permintaan, pengambilan, pengembalian, hingga penyelesaian pinjaman.'],
  ['Packaging Supplies', 'Melihat persediaan perlengkapan kemasan, mencatat barang masuk dan keluar, serta menentukan batas kapan stok perlu dipesan ulang.'],
  ['Reject Storage', 'Mencatat barang reject di koli Reguler atau Arkline. Barang yang keluar dari koli juga dicatat agar jumlah dan alasannya tetap terlacak.'],
]

export function StorageLocationHelpButton({ onClick }) {
  return <button type="button" className={styles.helpButton} onClick={onClick}
    aria-label="Lihat panduan Storage Location" title="Panduan Storage Location">?</button>
}

export default function StorageLocationGuide({ onClose }) {
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="storage-location-guide-title">
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>PANDUAN STORAGE</p>
            <h2 id="storage-location-guide-title">Storage Location</h2>
            <p className={styles.intro}>Fungsi setiap tab dalam alur penyimpanan barang.</p>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Tutup panduan" title="Tutup">×</button>
        </div>
        <div className={styles.list}>
          {SECTIONS.map(([title, description], index) => (
            <div className={styles.row} key={title}>
              <span className={styles.index}>{String(index + 1).padStart(2, '0')}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
