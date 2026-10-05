import type { Role } from '@time-manager/sdk'

import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'

const ROLE_STYLES: Record<Role, string> = {
  admin: 'border-transparent bg-destructive/10 text-destructive',
  employee: 'border-transparent bg-muted text-muted-foreground',
  manager: 'border-transparent bg-primary/10 text-primary',
}

export type RoleBadgeProps = { className?: string; role: Role }

export function RoleBadge({ className, role }: RoleBadgeProps) {
  const { t } = useTranslation('common')

  return (
    <Badge className={cn(ROLE_STYLES[role], className)} data-role={role}>
      {t(`roles.${role}`)}
    </Badge>
  )
}
