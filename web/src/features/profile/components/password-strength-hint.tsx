import { useTranslation } from 'react-i18next'

import { PasswordMeter } from '@/features/profile/lib/password-strength'
import { cn } from '@/lib/cn'

const SEGMENT_COLORS = ['bg-destructive', 'bg-amber-500', 'bg-lime-500', 'bg-emerald-600'] as const

export type PasswordStrengthHintProps = { password: string }

export function PasswordStrengthHint({ password }: PasswordStrengthHintProps) {
  const { t } = useTranslation('profile')
  const { label, score } = PasswordMeter.strength(password)
  const color = SEGMENT_COLORS[Math.max(score - 1, 0)]

  return (
    <div className="space-y-1.5">
      <div aria-hidden className="grid grid-cols-4 gap-1">
        {[1, 2, 3, 4].map((segment) => (
          <div
            className={cn('h-1.5 rounded-full bg-muted', segment <= score && color)}
            key={segment}
          />
        ))}
      </div>
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {password.length === 0
          ? t('password.hint')
          : t('password.strength', { label: t(`password.levels.${label}`) })}
      </p>
    </div>
  )
}
