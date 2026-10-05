import { createBrowserRouter } from 'react-router'

import { AppLayout } from '@/components/layout/app-layout'
import { AuthCallbackPage } from '@/features/auth/pages/auth-callback-page'
import { LoginPage } from '@/features/auth/pages/login-page'
import { NotFoundPage } from '@/features/errors/pages/not-found-page'
import { ProfilePage } from '@/features/profile/pages/profile-page'
import { TeamsPage } from '@/features/teams/pages/teams-page'
import { UsersPage } from '@/features/users/pages/users-page'
import { ProtectedRoute } from '@/lib/auth/protected-route'
import { RoleRoute } from '@/lib/auth/role-route'
import { RootLayout } from '@/lib/root-layout'

export const router = createBrowserRouter([
  {
    children: [
      { element: <LoginPage />, path: '/login' },
      { element: <AuthCallbackPage />, path: '/auth/callback' },
      {
        children: [
          {
            children: [
              {
                index: true,
                lazy: async () => ({
                  Component: (await import('@/features/dashboard/pages/dashboard-page'))
                    .DashboardPage,
                }),
              },
              { element: <ProfilePage />, path: 'me' },
              {
                children: [
                  { element: <UsersPage />, path: 'users' },
                  { element: <TeamsPage />, path: 'teams' },
                ],
                element: <RoleRoute roles={['manager', 'admin']} />,
              },
              { element: <NotFoundPage />, path: '*' },
            ],
            element: <AppLayout />,
          },
        ],
        element: <ProtectedRoute />,
      },
    ],
    element: <RootLayout />,
  },
])
