import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'

import { FullPageSpinner } from '@/components/layout/full-page-spinner'
import { saveFrom } from '@/lib/auth/redirect'
import { useAuth } from '@/lib/auth/use-auth'

export function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()
  const from = `${location.pathname}${location.search}`

  useEffect(() => {
    if (status === 'unauthenticated') saveFrom(from)
  }, [from, status])

  if (status === 'loading') return <FullPageSpinner />
  if (status === 'unauthenticated') {
    return <Navigate replace state={{ from }} to="/login" />
  }
  return <Outlet />
}
