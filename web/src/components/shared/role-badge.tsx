import type { Role } from '@time-manager/sdk'

import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'

export type RoleBadgeProps = {
  className?: string
  role: Role
}

export function RoleBadge({ className, role }: RoleBadgeProps) {
  const { t } = useTranslation('common')

  return (
    <Badge className={className} variant={role}>
      {t(`roles.${role}`)}
    </Badge>
  )
}
