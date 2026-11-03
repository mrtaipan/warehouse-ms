export default function ProductVariantCode({ code }) {
  if (!code) return null
  return <small style={{ display: 'block', marginTop: 4, fontSize: 12, lineHeight: 1.4, fontWeight: 400, color: '#64748b', overflowWrap: 'anywhere' }}>{code}</small>
}
