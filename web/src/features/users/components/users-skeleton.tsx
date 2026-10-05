import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'

export function UsersSkeleton() {
  const { t } = useTranslation('users')

  return (
    <div aria-busy className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="status">
      <span className="sr-only">{t('loading')}</span>
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton className="h-28 w-full" key={index} />
      ))}
    </div>
  )
}
