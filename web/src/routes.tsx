import type { ComponentType } from 'react'

import { Suspense } from 'react'
import { createBrowserRouter } from 'react-router'

import { AppLayout } from '@/components/layout/app-layout'
import { FullPageSpinner } from '@/components/layout/full-page-spinner'
import { Skeleton } from '@/components/ui/skeleton'
import { AuthCallbackPage } from '@/features/auth/pages/auth-callback-page'
import { LoginPage } from '@/features/auth/pages/login-page'
import { NotFoundPage } from '@/features/errors/pages/not-found-page'
import { ProfilePage } from '@/features/profile/pages/profile-page'
import { UsersPage } from '@/features/users/pages/users-page'
import { ProtectedRoute } from '@/lib/auth/protected-route'
import { RoleRoute } from '@/lib/auth/role-route'
import { RootLayout } from '@/lib/root-layout'

function PageSkeleton() {
  return (
    <div aria-busy className="space-y-6" role="status">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <Skeleton className="h-64 w-full" />
      <span className="sr-only">Loading</span>
    </div>
  )
}

/** Lazy route: code-split page with a skeleton fallback while the chunk loads. */
function lazyPage(load: () => Promise<ComponentType>) {
  return {
    lazy: async () => {
      const Page = await load()
      return {
        Component: () => (
          <Suspense fallback={<PageSkeleton />}>
            <Page />
          </Suspense>
        ),
      }
    },
  }
}

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
                ...lazyPage(
                  async () =>
                    (await import('@/features/dashboard/pages/dashboard-page')).DashboardPage,
                ),
              },
              {
                path: 'clocks',
                ...lazyPage(
                  async () => (await import('@/features/clocks/pages/clocks-page')).ClocksPage,
                ),
              },
              {
                path: 'teams',
                ...lazyPage(
                  async () => (await import('@/features/teams/pages/teams-page')).TeamsPage,
                ),
              },
              {
                path: 'teams/:id',
                ...lazyPage(
                  async () => (await import('@/features/teams/pages/team-page')).TeamPage,
                ),
              },
              { element: <ProfilePage />, path: 'me' },
              {
                children: [
                  { element: <UsersPage />, path: 'users' },
                  {
                    path: 'reports/users/:id',
                    ...lazyPage(
                      async () =>
                        (await import('@/features/reports/pages/user-report-page')).UserReportPage,
                    ),
                  },
                  {
                    path: 'teams/:id/dashboard',
                    ...lazyPage(
                      async () =>
                        (await import('@/features/reports/pages/team-report-page')).TeamReportPage,
                    ),
                  },
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
    HydrateFallback: FullPageSpinner,
  },
])
