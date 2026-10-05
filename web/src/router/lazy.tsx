import type { ComponentType, ReactElement } from 'react'

import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'

export function PageSkeleton() {
  const { t } = useTranslation('common')

  return (
    <div aria-busy className="space-y-6" role="status">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <Skeleton className="h-64 w-full" />
      <span className="sr-only">{t('state.loading')}</span>
    </div>
  )
}

export function pick<K extends string>(name: K) {
  return <M extends Record<K, ComponentType>>(module: M) => ({ default: module[name] })
}

export class Lazy {
  /**
   * @route client.router.lazy.element
   * @param {() => Promise<{ default: ComponentType }>} load Dynamic import, usually `import('@/features/x/pages').then(pick('XPage'))`.
   * @returns {ReactElement} Route element code-split behind a skeleton.
   */
  static element(load: () => Promise<{ default: ComponentType }>): ReactElement {
    const Page = lazy(load)
    return (
      <Suspense fallback={<PageSkeleton />}>
        <Page />
      </Suspense>
    )
  }
}
