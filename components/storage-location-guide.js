'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import styles from './storage-location-guide.module.css'

const SECTIONS = [
  ['Current Stock', 'Melihat stok yang sudah tersimpan di pallet atau shelving. Dari sini barang dapat dipindahkan, dikeluarkan, atau dikirim ke area sementara.'],
  ['Storage Queue', 'Antrean barang dari packing list yang belum ditempatkan di gudang. Barang dapat disimpan ke lokasi atau dipindahkan ke Temp. Sales Area.'],
  ['Temp. Sales Area', 'Area sementara untuk barang yang disiapkan bagi penjualan. Stoknya dapat berkurang dari data penjualan yang diunggah, lalu sisa barang dikembalikan ke gudang atau dipindahkan ke Temp. Retur Keeping.'],
  ['Temp. Retur Keeping', 'Area sementara untuk barang yang disisihkan bagi proses retur atau penggantian. Barang di sini dapat dikeluarkan atau disimpan kembali ke gudang.'],
  ['Shelving Queue', 'Antrean barang yang akan ditempatkan ke shelving, misalnya kelebihan pengambilan saat restock atau barang retur yang belum mendapat lokasi shelving.'],
  ['Product Loans', 'Mencatat peminjaman barang untuk keperluan seperti foto atau konten, mulai dari permintaan, pengambilan, pengembalian, hingga penyelesaian pinjaman.'],
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
