import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { InboxIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export type EmptyProps = {
  action?: ReactNode
  description?: string
  icon?: LucideIcon
  title?: string
}

export function Empty({ action, description, icon: Icon = InboxIcon, title }: EmptyProps) {
  const { t } = useTranslation('common')

  return (
    <div
      className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center"
      role="status"
    >
      <Icon aria-hidden className="size-8 text-muted-foreground" />
      <div className="space-y-1">
        <p className="font-medium">{title ?? t('empty.title')}</p>
        <p className="text-sm text-muted-foreground">{description ?? t('empty.description')}</p>
      </div>
      {action}
    </div>
  )
}
