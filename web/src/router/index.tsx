import type { RouteObject } from 'react-router'

import { createBrowserRouter } from 'react-router'

import { AppLayout } from '@/components/layout/app-layout'
import { FullPageSpinner } from '@/components/layout/full-page-spinner'
import { RESOURCE_SCOPES } from '@/lib/scopes'
import { AuthGuard, GuestGuard, PermissionGuard } from '@/router/guards'
import { Lazy, pick } from '@/router/lazy'
import { RouteError } from '@/router/route-error'

export const routes: RouteObject[] = [
  {
    children: [
      {
        children: [
          {
            element: Lazy.element(() =>
              import('@/features/auth/pages/login-page').then(pick('LoginPage')),
            ),
            path: '/login',
          },
        ],
        element: <GuestGuard />,
      },
      {
        element: Lazy.element(() =>
          import('@/features/auth/pages/auth-callback-page').then(pick('AuthCallbackPage')),
        ),
        path: '/auth/callback',
      },
      {
        children: [
          {
            children: [
              {
                element: Lazy.element(() =>
                  import('@/features/dashboard/pages/dashboard-page').then(pick('DashboardPage')),
                ),
                index: true,
              },
              {
                element: Lazy.element(() =>
                  import('@/features/clocks/pages/clocks-page').then(pick('ClocksPage')),
                ),
                path: 'clocks',
              },
              {
                element: Lazy.element(() =>
                  import('@/features/teams/pages/teams-page').then(pick('TeamsPage')),
                ),
                path: 'teams',
              },
              {
                element: Lazy.element(() =>
                  import('@/features/teams/pages/team-page').then(pick('TeamPage')),
                ),
                path: 'teams/:teamId',
              },
              {
                children: [
                  {
                    element: Lazy.element(() =>
                      import('@/features/reports/pages/team-report-page').then(
                        pick('TeamReportPage'),
                      ),
                    ),
                    path: 'teams/:teamId/dashboard',
                  },
                ],
                element: <PermissionGuard scope={RESOURCE_SCOPES.teams.manage} />,
              },
              {
                children: [
                  {
                    element: Lazy.element(() =>
                      import('@/features/users/pages/users-page').then(pick('UsersPage')),
                    ),
                    path: 'users',
                  },
                  {
                    element: Lazy.element(() =>
                      import('@/features/users/pages/users-page').then(pick('UsersPage')),
                    ),
                    path: 'users/:userId',
                  },
                  {
                    element: Lazy.element(() =>
                      import('@/features/reports/pages/user-report-page').then(
                        pick('UserReportPage'),
                      ),
                    ),
                    path: 'reports/users/:userId',
                  },
                ],
                element: <PermissionGuard scope={RESOURCE_SCOPES.users.manage} />,
              },
              {
                element: Lazy.element(() =>
                  import('@/features/profile/pages/profile-page').then(pick('ProfilePage')),
                ),
                path: 'me',
              },
              {
                element: Lazy.element(() =>
                  import('@/features/errors/pages/not-found-page').then(pick('NotFoundPage')),
                ),
                path: '*',
              },
            ],
            element: <AppLayout />,
          },
        ],
        element: <AuthGuard />,
      },
    ],
    errorElement: <RouteError />,
    HydrateFallback: FullPageSpinner,
  },
]

export const router = createBrowserRouter(routes)
