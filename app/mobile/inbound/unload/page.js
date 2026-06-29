import UnloadPage from '../../../dashboard/inbound/unload/page'
import { Suspense } from 'react'

export default function MobileUnloadPage() {
  return (
    <Suspense fallback={<div>Loading unload builder...</div>}>
      <UnloadPage />
    </Suspense>
  )
}
