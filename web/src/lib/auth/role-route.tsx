import { Navigate, Outlet } from 'react-router'

import type { Role } from '@/features/auth/api/auth'

import { useAuth } from '@/lib/auth/use-auth'

export function RoleRoute({ roles }: { roles: Role[] }) {
  const { user } = useAuth()

  if (!user || !roles.includes(user.role)) return <Navigate replace to="/" />
  return <Outlet />
}
