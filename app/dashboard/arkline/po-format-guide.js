'use client'

import styles from './production-planning/production-planning.module.css'

export function PoFormatHelpButton({ onClick }) {
  return <button type="button" className={styles.poFormatGuideButton}
    onClick={onClick} aria-label="Show Arkline PO number format" title="PO number format">?</button>
}

export default function PoFormatGuide({ onClose }) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modalCard} ${styles.poFormatGuide}`.trim()} role="dialog" aria-modal="true" aria-labelledby="po-format-guide-title" onClick={(event) => event.stopPropagation()}>
        <div className={styles.poFormatGuideHeader}>
          <div>
            <p className={styles.poFormatEyebrow}>ARKLINE REFERENCE</p>
            <h2 id="po-format-guide-title" className={styles.modalTitle}>How to read a PO number</h2>
          </div>
          <button type="button" className={styles.poFormatGuideClose} onClick={onClose} aria-label="Close PO number guide">×</button>
        </div>
        <div className={styles.poFormatExample} aria-label="Example garment PO: PO-24-ARK/FG/PHX-TEMPORER">
          <span>PO-24</span><span>-</span><span>ARK</span><span>/</span><span>FG</span><span>/</span><span>PHX</span><span>-</span><span>TEMPORER</span>
        </div>
        <div className={styles.poFormatLegend}>
          <div><strong>PO-24</strong><span>Shared sequence for Garment and Material POs. A linked Material PO keeps its Garment PO number; a standalone Material PO takes the next number.</span></div>
          <div><strong>ARK / IDV / MKG</strong><span>ARK = with PPN; IDV = without PPN; MKG = fabric Material PO.</span></div>
          <div><strong>FG / CG / FM / CM / SA</strong><span>FG = FOB Garment; CG = CMT Garment; FM = FOB Material; CM = CMT Material; SA = standalone Material (No PO).</span></div>
          <div><strong>PHX</strong><span>Initial of the selected supplier, shown after the second slash.</span></div>
          <div><strong>TEMPORER / DATE</strong><span>Garment PO stays TEMPORER while checked; when issued, the suffix becomes day + Roman month + year, for example 04XI2026. Material PO uses its issue date.</span></div>
        </div>
        <div className={styles.poFormatExamples}>
          <p><strong>Garment</strong><code>PO-24-IDV/CG/PHX-04XI2026</code></p>
          <p><strong>Linked material</strong><code>PO-24-MKG/CM/NRW-04XI2026</code></p>
          <p><strong>Standalone material</strong><code>PO-25-ARK/SA/NRW-04XI2026</code></p>
        </div>
      </div>
    </div>
  )
}
