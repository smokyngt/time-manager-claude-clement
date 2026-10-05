import type { Ref } from 'react'

import { SearchIcon, XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LIMITS } from '@/config/limits'
import { cn } from '@/lib/cn'

export type SearchInputProps = {
  className?: string
  inputRef?: Ref<HTMLInputElement>
  label?: string
  onChange: (value: string) => void
  placeholder?: string
  value: string
}

export function SearchInput({
  className,
  inputRef,
  label,
  onChange,
  placeholder,
  value,
}: SearchInputProps) {
  const { t } = useTranslation('common')

  return (
    <div className={cn('relative w-full sm:max-w-xs', className)} role="search">
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        aria-label={label ?? t('search.label')}
        className="px-8"
        maxLength={LIMITS.name}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        placeholder={placeholder ?? t('search.placeholder')}
        ref={inputRef}
        type="search"
        value={value}
      />
      {value ? (
        <Button
          aria-label={t('search.clear')}
          className="absolute top-1/2 right-0.5 size-8 -translate-y-1/2"
          onClick={() => {
            onChange('')
          }}
          size="icon"
          type="button"
          variant="ghost"
        >
          <XIcon />
        </Button>
      ) : null}
    </div>
  )
}
