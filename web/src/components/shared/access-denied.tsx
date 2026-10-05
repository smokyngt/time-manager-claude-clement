import { ShieldAlertIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'

export function AccessDenied() {
  const { t } = useTranslation('common')

  return (
    <div className="grid min-h-[60dvh] place-items-center p-4 text-center" role="alert">
      <div className="space-y-4">
        <ShieldAlertIcon aria-hidden className="mx-auto size-10 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">{t('access_denied.title')}</h1>
        <p className="text-muted-foreground">{t('access_denied.description')}</p>
        <Button asChild>
          <Link to="/">{t('access_denied.back')}</Link>
        </Button>
      </div>
    </div>
  )
}
