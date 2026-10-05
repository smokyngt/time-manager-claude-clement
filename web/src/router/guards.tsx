import type { Scope } from '@time-manager/sdk'

import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router'

import { FullPageSpinner } from '@/components/layout/full-page-spinner'
import { AccessDenied } from '@/components/shared/access-denied'
import { AuthRedirect } from '@/lib/auth-redirect'
import { Permission } from '@/lib/permission'
import { useAuth } from '@/providers/use-auth'

export function AuthGuard() {
  const { status } = useAuth()
  const { hash, pathname, search } = useLocation()

  if (status === 'loading') {
    return <FullPageSpinner />
  }
  if (status === 'unauthenticated') {
    return <Navigate replace to={AuthRedirect.loginUrl(`${pathname}${search}${hash}`)} />
  }
  return <Outlet />
}

export function GuestGuard() {
  const { status } = useAuth()
  const [params] = useSearchParams()

  if (status === 'loading') {
    return <FullPageSpinner />
  }
  if (status === 'authenticated') {
    return <Navigate replace to={AuthRedirect.sanitize(params.get('redirect'))} />
  }
  return <Outlet />
}

export type PermissionGuardProps = {
  mode?: 'all' | 'any'
  scope: readonly Scope[] | Scope
}

export function PermissionGuard({ mode = 'any', scope }: PermissionGuardProps) {
  const { scopes } = useAuth()
  const required = typeof scope === 'string' ? [scope] : scope
  const allowed = Permission.scope[mode](scopes, required)

  return allowed ? <Outlet /> : <AccessDenied />
}
