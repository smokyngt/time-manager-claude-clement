import { cn } from '@/lib/cn'

export type CharCountProps = {
  className?: string
  id?: string
  length: number
  max: number
}

export function CharCount({ className, id, length, max }: CharCountProps) {
  return (
    <span
      className={cn(
        'text-xs text-muted-foreground tabular-nums',
        length > max && 'text-destructive',
        className,
      )}
      id={id}
    >
      {length}/{max}
    </span>
  )
}
