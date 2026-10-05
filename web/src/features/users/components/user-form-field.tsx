import type { ReactNode } from 'react'

import { Label } from '@/components/ui/label'
import { cn } from '@/lib/cn'

export type UserFormFieldProps = {
  children: ReactNode
  className?: string
  error?: string
  hint?: string
  id: string
  label: string
}

export function UserFormField({ children, className, error, hint, id, label }: UserFormFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? (
        <p className="text-xs text-muted-foreground" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
