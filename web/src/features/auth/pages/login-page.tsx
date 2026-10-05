import { Navigate, useLocation, useNavigate } from 'react-router'

import { FullPageSpinner } from '@/components/layout/full-page-spinner'
import { Logo } from '@/components/layout/logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoginForm } from '@/features/auth/components/login-form'
import { MICROSOFT_LOGIN_URL } from '@/lib/api/config'
import { useAuth } from '@/lib/auth/use-auth'

function MicrosoftIcon() {
  return (
    <svg aria-hidden height="16" viewBox="0 0 21 21" width="16">
      <rect fill="#f25022" height="9" width="9" x="1" y="1" />
      <rect fill="#7fba00" height="9" width="9" x="11" y="1" />
      <rect fill="#00a4ef" height="9" width="9" x="1" y="11" />
      <rect fill="#ffb900" height="9" width="9" x="11" y="11" />
    </svg>
  )
}

export function LoginPage() {
  const { status } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (status === 'loading') return <FullPageSpinner />
  if (status === 'authenticated') return <Navigate replace to={from} />

  return (
    <div className="grid min-h-dvh place-items-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>Sign in to track your time</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <LoginForm
              onSuccess={() => {
                void navigate(from, { replace: true })
              }}
            />
            <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button asChild className="w-full" variant="outline">
              <a href={MICROSOFT_LOGIN_URL}>
                <MicrosoftIcon />
                Sign in with Microsoft
              </a>
            </Button>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">
          Accounts are created by your manager.
        </p>
      </div>
    </div>
  )
}
