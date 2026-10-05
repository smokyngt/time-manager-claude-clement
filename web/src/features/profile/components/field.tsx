import type { ReactNode } from 'react'

import { Label } from '@/components/ui/label'

export type FieldProps = {
  children: ReactNode
  className?: string
  error?: string
  id: string
  label: string
}

export function Field({ children, className, error, id, label }: FieldProps) {
  return (
    <div className={className}>
      <div className="space-y-2">
        <Label htmlFor={id}>{label}</Label>
        {children}
        {error ? (
          <p className="text-sm text-destructive" id={`${id}-error`} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
