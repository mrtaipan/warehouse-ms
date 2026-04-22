import { redirect } from 'next/navigation'

export default async function ReceivingOrderInboundRedirectPage({ params }) {
  const resolvedParams = await params
  redirect(`/dashboard/inbound/${resolvedParams.id}`)
}
