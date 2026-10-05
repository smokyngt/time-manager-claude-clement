import { Outlet } from 'react-router'

import { AuthProvider } from '@/lib/auth/auth-provider'

export function RootLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}
