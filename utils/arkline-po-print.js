export function buildArklinePoPrintStyles(poNumber) {
  const safePoNumber = String(poNumber || '').trim().toUpperCase().replace(/[^A-Z0-9/_-]/g, '')

  return `
    @page {
      size: A4;
      margin: 12mm 0;
      @top-left {
        content: "PO CONTINUED - ${safePoNumber}";
        margin-left: 14mm;
        color: #111827;
        font: 700 9pt Arial, sans-serif;
      }
      @top-right {
        content: "Page " counter(page) " of " counter(pages);
        margin-right: 14mm;
        color: #64748b;
        font: 8pt Arial, sans-serif;
      }
      @bottom-right {
        content: "Paraf: __________________";
        margin-right: 14mm;
        color: #111827;
        font: 8pt Arial, sans-serif;
      }
    }
    @page :first {
      margin: 0;
      @top-left { content: none; }
      @top-right { content: none; }
      @bottom-right { content: none; }
    }
    body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .po-sheet {
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      width: 210mm;
      min-height: 297mm;
      padding: 14mm;
    }
    .po-bottom { margin-top: auto; break-inside: avoid; page-break-inside: avoid; }
    .po-items-table thead { display: table-header-group; }
    .po-items-table tr { break-inside: avoid; page-break-inside: avoid; }
    @media print {
      .po-sheet { width: 210mm !important; padding: 14mm !important; }
      .po-bottom { break-inside: avoid; page-break-inside: avoid; }
    }
  `
}
