import type { User } from '@time-manager/sdk'

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/shared/error-state'
import { SearchInput } from '@/components/shared/search-input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { LIMITS } from '@/config/limits'
import { TeamFormat } from '@/features/teams/lib/team-format'

export type AddMembersDialogProps = {
  candidates: readonly User[]
  error?: unknown
  isError?: boolean
  loading?: boolean
  memberIds: ReadonlySet<string>
  onOpenChange: (open: boolean) => void
  onRetry?: () => void
  onSubmit: (userIds: string[]) => void
  open: boolean
  submitting?: boolean
}

export function AddMembersDialog({
  candidates,
  error,
  isError = false,
  loading = false,
  memberIds,
  onOpenChange,
  onRetry,
  onSubmit,
  open,
  submitting = false,
}: AddMembersDialogProps) {
  const { t } = useTranslation('teams')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<readonly string[]>([])

  const options = useMemo(() => {
    const query = search.trim().toLowerCase()
    return candidates.filter(
      (candidate) =>
        !memberIds.has(candidate.id) &&
        `${TeamFormat.userName(candidate)} ${candidate.email}`.toLowerCase().includes(query),
    )
  }, [candidates, memberIds, search])

  const toggle = (id: string, checked: boolean) => {
    setSelected((current) => (checked ? [...current, id] : current.filter((value) => value !== id)))
  }

  const changeOpen = (next: boolean) => {
    if (!next) {
      setSearch('')
      setSelected([])
    }
    onOpenChange(next)
  }

  const limitReached = selected.length >= LIMITS.bulkIds

  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('members.add.title')}</DialogTitle>
          <DialogDescription>{t('members.add.description')}</DialogDescription>
        </DialogHeader>
        <SearchInput
          label={t('members.add.search')}
          onChange={setSearch}
          placeholder={t('members.add.search_placeholder')}
          value={search}
        />
        {loading ? (
          <div aria-busy className="space-y-2" role="status">
            <span className="sr-only">{t('common:state.loading')}</span>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton className="h-10 w-full" key={index} />
            ))}
          </div>
        ) : null}
        {isError ? <ErrorState error={error} onRetry={onRetry} /> : null}
        {!loading && !isError && options.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('members.add.none')}</p>
        ) : null}
        {options.length > 0 ? (
          <ul
            aria-label={t('members.add.available')}
            className="max-h-64 divide-y overflow-y-auto rounded-md border"
          >
            {options.map((option) => {
              const checked = selected.includes(option.id)
              return (
                <li className="flex items-center gap-3 px-3 py-2" key={option.id}>
                  <Checkbox
                    checked={checked}
                    disabled={!checked && limitReached}
                    id={`add-member-${option.id}`}
                    onCheckedChange={(value) => {
                      toggle(option.id, value === true)
                    }}
                  />
                  <Label
                    className="flex-1 flex-col items-start gap-0"
                    htmlFor={`add-member-${option.id}`}
                  >
                    <span className="font-medium">{TeamFormat.userName(option)}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {option.email}
                    </span>
                  </Label>
                </li>
              )
            })}
          </ul>
        ) : null}
        <DialogFooter>
          <Button
            onClick={() => {
              changeOpen(false)
            }}
            type="button"
            variant="outline"
          >
            {t('common:actions.cancel')}
          </Button>
          <Button
            disabled={selected.length === 0 || submitting}
            onClick={() => {
              onSubmit([...selected])
            }}
            type="button"
          >
            {t('members.add.submit', { count: selected.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
