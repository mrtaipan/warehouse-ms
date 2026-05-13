import { redirect } from 'next/navigation'

export default function LegacyInboundQcRedirectPage() {
  redirect('/mobile/qc/receiving')
}
