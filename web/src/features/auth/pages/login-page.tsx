import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'

import { Logo } from '@/components/layout/logo'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoginForm, MicrosoftButton } from '@/features/auth/components'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { AuthRedirect } from '@/lib/auth-redirect'
import { useAuth } from '@/providers/use-auth'

export function LoginPage() {
  const { t } = useTranslation('auth')
  const { loginWithMicrosoft } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const redirect = AuthRedirect.sanitize(params.get('redirect'))

  useDocumentTitle(t('title'))

  return (
    <main className="grid min-h-dvh place-items-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle aria-level={1} className="text-xl" role="heading">
              {t('login.title')}
            </CardTitle>
            <CardDescription>{t('login.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <LoginForm
              onSuccess={() => {
                void navigate(redirect, { replace: true })
              }}
            />
            <div
              aria-hidden
              className="flex items-center gap-3 text-xs text-muted-foreground uppercase"
            >
              <span className="h-px flex-1 bg-border" />
              {t('login.or')}
              <span className="h-px flex-1 bg-border" />
            </div>
            <MicrosoftButton
              onClick={() => {
                loginWithMicrosoft(redirect)
              }}
            />
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">{t('login.footer')}</p>
      </div>
    </main>
  )
}
