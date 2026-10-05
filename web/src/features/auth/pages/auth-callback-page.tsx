import { Loader2Icon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useSearchParams } from 'react-router'

import { Button } from '@/components/ui/button'
import { CallbackError } from '@/features/auth/lib/callback-error'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { AuthRedirect } from '@/lib/auth-redirect'
import { useAuth } from '@/providers/use-auth'

export function AuthCallbackPage() {
  const { t } = useTranslation('auth')
  const { status } = useAuth()
  const [params] = useSearchParams()
  const code = params.get('error')
  const heading = useRef<HTMLHeadingElement>(null)
  const failed = code !== null || status === 'unauthenticated'

  useDocumentTitle(failed ? t('callback.title') : t('title'))

  useEffect(() => {
    if (failed) {
      heading.current?.focus()
    }
  }, [failed])

  if (!failed && status === 'authenticated') {
    return <Navigate replace to={AuthRedirect.consume()} />
  }

  if (failed) {
    return (
      <main className="grid min-h-dvh place-items-center bg-muted/40 p-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-semibold outline-none" ref={heading} tabIndex={-1}>
            {t('callback.title')}
          </h1>
          <p className="text-sm text-muted-foreground" role="alert">
            {t(CallbackError.key(code))}
          </p>
          <Button asChild>
            <Link replace to="/login">
              {t('callback.back')}
            </Link>
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="grid min-h-dvh place-items-center">
      <div aria-live="polite" className="flex items-center gap-2 text-sm" role="status">
        <Loader2Icon aria-hidden className="size-5 animate-spin text-primary" />
        <span>{t('callback.completing')}</span>
      </div>
    </main>
  )
}
