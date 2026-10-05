import { useEffect } from 'react'
import { Navigate } from 'react-router'
import { toast } from 'sonner'

import { FullPageSpinner } from '@/components/layout/full-page-spinner'
import { refreshSession } from '@/lib/auth/session'
import { useAuth } from '@/lib/auth/use-auth'

export function AuthCallbackPage() {
  const { status } = useAuth()

  useEffect(() => {
    refreshSession().catch(() => undefined)
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') toast.error('Microsoft sign-in failed. Please try again.')
  }, [status])

  if (status === 'authenticated') return <Navigate replace to="/" />
  if (status === 'unauthenticated') return <Navigate replace to="/login" />
  return <FullPageSpinner />
}
