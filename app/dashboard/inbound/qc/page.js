import { redirect } from 'next/navigation'

export default function LegacyInboundQcRedirectPage() {
  redirect('/dashboard/qc/receiving')
}
