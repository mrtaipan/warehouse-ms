'use client'

export default function ArklineReQcSourceSwitch({ loanMode, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={loanMode}
      aria-label={`Re-QC source: ${loanMode ? 'Loan Number' : 'PO ID'}`}
      title={`Switch to ${loanMode ? 'PO ID' : 'Loan Number'}`}
      onClick={() => onChange(loanMode ? 'arkline' : 'arkline-loan')}
      style={{ display: 'inline-flex', alignItems: 'center', minHeight: 24, padding: 0, border: 0, background: 'transparent', cursor: 'pointer' }}
    >
      <span style={{ width: 34, height: 19, padding: 2, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: loanMode ? 'flex-end' : 'flex-start', background: loanMode ? '#0f766e' : '#cbd5e1', transition: 'background 140ms ease' }}>
        <span style={{ width: 15, height: 15, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px #0002' }} />
      </span>
    </button>
  )
}
