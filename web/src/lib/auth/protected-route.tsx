import { Navigate, Outlet, useLocation } from 'react-router'

import { FullPageSpinner } from '@/components/layout/full-page-spinner'
import { useAuth } from '@/lib/auth/use-auth'

export function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageSpinner />
  if (status === 'unauthenticated') {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />
  }
  return <Outlet />
}
