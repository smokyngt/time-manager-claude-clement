import { ShieldAlertIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { CenteredLayout } from '@/components/layout/centered-layout'
import { Button } from '@/components/ui/button'

export function AccessDenied() {
  const { t } = useTranslation('common')

  return (
    <div role="alert">
      <CenteredLayout
        description={t('access_denied.description')}
        icon={ShieldAlertIcon}
        standalone={false}
        title={t('access_denied.title')}
      >
        <Button asChild>
          <Link to="/">{t('access_denied.back')}</Link>
        </Button>
      </CenteredLayout>
    </div>
  )
}
