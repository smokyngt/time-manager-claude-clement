import { useEffect } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { FullPageSpinner } from '@/components/layout/full-page-spinner'
import { Button } from '@/components/ui/button'
import { getCallbackErrorMessage } from '@/features/auth/auth-errors'
import { consumeFrom } from '@/lib/auth/redirect'
import { useAuth } from '@/lib/auth/use-auth'

export function AuthCallbackPage() {
  const { status } = useAuth()
  const [params] = useSearchParams()
  const error_code = params.get('error')

  // Without ?error=, the auth provider's boot refresh (cookie) completes the sign-in.
  useEffect(() => {
    if (!error_code && status === 'unauthenticated') {
      toast.error('Microsoft sign-in failed. Please try again.')
    }
  }, [error_code, status])

  if (error_code) {
    return (
      <div className="grid min-h-dvh place-items-center bg-muted/40 p-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-semibold">Sign-in failed</h1>
          <p className="text-sm text-muted-foreground" role="alert">
            {getCallbackErrorMessage(error_code)}
          </p>
          <Button asChild>
            <Link replace to="/login">
              Back to login
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  if (status === 'authenticated') return <Navigate replace to={consumeFrom()} />
  if (status === 'unauthenticated') return <Navigate replace to="/login" />
  return <FullPageSpinner />
}
