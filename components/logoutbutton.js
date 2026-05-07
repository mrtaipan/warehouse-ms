'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'

const defaultStyles = {
  button: {
    marginTop: 20,
    padding: '10px 16px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    fontWeight: 600,
  },
  icon: {
    width: 18,
    height: 18,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}

export default function LogoutButton({
  className,
  style,
  label = 'Logout',
  labelClassName,
  iconClassName,
  title = 'Logout',
}) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className={className}
      style={{ ...defaultStyles.button, ...style }}
      title={title}
    >
      <span style={defaultStyles.icon} className={iconClassName}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ width: '18px', height: '18px', display: 'block' }}
        >
          <path d="M10 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
          <path d="M17 16l4-4-4-4" />
          <path d="M21 12H9" />
        </svg>
      </span>
      {label ? <span className={labelClassName}>{label}</span> : null}
    </button>
  )
}
