import { SearchXIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Empty } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks'

export function NotFoundPage() {
  const { t } = useTranslation('common')
  useDocumentTitle(t('not_found.title'))

  return (
    <div className="grid min-h-[60dvh] place-items-center p-4">
      <Empty
        action={
          <Button asChild>
            <Link to="/">{t('not_found.back')}</Link>
          </Button>
        }
        description={t('not_found.description')}
        icon={SearchXIcon}
        title={`${t('not_found.code')} · ${t('not_found.title')}`}
      />
    </div>
  )
}
