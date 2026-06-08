'use client'

import MobGroupPaymentClient from '../payments/mob-group-payment-client'

export default function MobPaymentPanelClient() {
  return (
    <MobGroupPaymentClient
      mode="hrga"
      panelTitle="MOB Group Payment Submission"
      panelSubtitle="Review, approve, and mark MOB payment requests as paid from HRGA."
      showHeader
      allowCreate={false}
    />
  )
}
