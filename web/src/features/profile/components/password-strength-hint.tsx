import { passwordStrength } from '@/features/profile/password-strength'
import { cn } from '@/lib/utils'

const SEGMENT_COLORS = ['bg-destructive', 'bg-amber-500', 'bg-lime-500', 'bg-emerald-600'] as const

export function PasswordStrengthHint({ password }: { password: string }) {
  const { label, score } = passwordStrength(password)
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
          ? 'Use at least 12 characters. Mix letters, numbers and symbols.'
          : `Password strength: ${label}`}
      </p>
    </div>
  )
}
