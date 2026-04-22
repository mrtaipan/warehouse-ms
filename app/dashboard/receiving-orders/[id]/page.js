import { redirect } from 'next/navigation'

export default async function ReceivingOrderDetailPage({ params }) {
  const resolvedParams = await params
  redirect(`/dashboard/inbound/${resolvedParams.id}`)
}
