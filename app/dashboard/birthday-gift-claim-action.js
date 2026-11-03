'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { submitBirthdayGiftRequest } from './human-resources/actions'
import { getJakartaTodayDateString } from '@/utils/birthday-reminders.mjs'
import dashboardStyles from './dashboard.module.css'
import formStyles from './myarklife/myarklife.module.css'

export default function BirthdayGiftClaimAction() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function submit(formData) {
    setError('')
    formData.set('request_date', getJakartaTodayDateString())
    startTransition(async () => {
      try {
        await submitBirthdayGiftRequest(formData)
        setSubmitted(true)
        setOpen(false)
        router.refresh()
      } catch (submitError) {
        setError(submitError?.message || 'Unable to submit birthday gift request.')
      }
    })
  }

  return (
    <>
      {submitted ? (
        <p className={dashboardStyles.birthdayClaimSuccess} role="status">Gift request submitted successfully.</p>
      ) : (
        <button type="button" className={dashboardStyles.birthdayClaimButton} onClick={() => setOpen(true)}>
          Claim Gift
        </button>
      )}
      {open ? (
        <div className={formStyles.modalOverlay} onClick={(event) => {
          if (event.target === event.currentTarget && !pending) setOpen(false)
        }}>
          <div className={formStyles.modalCard} role="dialog" aria-modal="true" aria-labelledby="dashboard-gift-title">
            <div className={formStyles.modalHeader}>
              <h2 id="dashboard-gift-title" className={formStyles.modalTitle}>Birthday Gift Request</h2>
            </div>
            <div className={formStyles.modalBody}>
              <form className={formStyles.modalForm} action={submit}>
                <label className={formStyles.field}>
                  <span className={formStyles.label}>Item Name</span>
                  <input className={formStyles.input} type="text" name="item_name" placeholder="Enter gift item name" required autoFocus />
                </label>
                <label className={formStyles.field}>
                  <span className={formStyles.label}>Size</span>
                  <input className={formStyles.input} type="text" name="size" placeholder="S, M, L, XL" />
                </label>
                {error ? <p className={formStyles.errorText} role="alert">{error}</p> : null}
                <div className={formStyles.modalActions}>
                  <button type="button" className={formStyles.cancelButton} onClick={() => setOpen(false)} disabled={pending}>
                    Cancel
                  </button>
                  <button type="submit" className={formStyles.primaryButton} disabled={pending}>
                    {pending ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
