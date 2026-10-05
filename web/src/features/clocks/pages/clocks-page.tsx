import type { ReactNode } from 'react'

import { AlertCircleIcon, ClockIcon, Loader2Icon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import type { Clock } from '@/features/clocks/api/types'
import type { RangePreset } from '@/features/clocks/lib/ranges'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ClocksFilters } from '@/features/clocks/components/clocks-filters'
import { ClocksTable } from '@/features/clocks/components/clocks-table'
import { DeleteEntryDialog } from '@/features/clocks/components/delete-entry-dialog'
import { AddEntryButton, ManualEntryDialog } from '@/features/clocks/components/manual-entry-dialog'
import { useClocks } from '@/features/clocks/hooks/use-clocks'
import { customRange, presetRange } from '@/features/clocks/lib/ranges'
import { useUsers } from '@/features/users/hooks/use-users'
import { getErrorMessage } from '@/lib/api/errors'
import { useAuth } from '@/lib/auth/use-auth'

function StateMessage({
  action,
  description,
  icon: Icon,
  title,
}: {
  action?: ReactNode
  description: string
  icon: typeof ClockIcon
  title: string
}) {
  return (
    <Card>
      <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
          <Icon aria-hidden className="size-6" />
        </div>
        <h2 className="font-semibold">{title}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        {action}
      </div>
    </Card>
  )
}

export function ClocksPage() {
  const { user } = useAuth()
  const own_id = user?.id ?? ''
  const can_manage = user?.role === 'manager' || user?.role === 'admin'
  const [preset, setPreset] = useState<RangePreset>('this_week')
  const [custom_from, setCustomFrom] = useState('')
  const [custom_to, setCustomTo] = useState('')
  const [selected_user, setSelectedUser] = useState<null | string>(null)
  const [editing, setEditing] = useState<Clock | null>(null)
  const [deleting, setDeleting] = useState<Clock | null>(null)
  const users_query = useUsers({ archived: false, role: 'all' })
  const target_id = selected_user ?? own_id

  const range = useMemo(
    () => (preset === 'custom' ? customRange(custom_from, custom_to) : presetRange(preset)),
    [preset, custom_from, custom_to],
  )

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isPending,
    refetch,
  } = useClocks(
    { from: range?.from, to: range?.to, user_ids: can_manage ? [target_id] : undefined },
    Boolean(range) && Boolean(target_id),
  )

  const user_options = useMemo(
    () =>
      (users_query.data?.pages.flatMap((page) => page.items) ?? []).map((item) => ({
        id: item.id,
        label: `${item.first_name} ${item.last_name}`,
      })),
    [users_query.data],
  )

  const { fetchNextPage: fetchMoreUsers, hasNextPage: has_more_users } = users_query

  useEffect(() => {
    if (can_manage && has_more_users && !users_query.isFetchingNextPage) {
      void fetchMoreUsers()
    }
  }, [can_manage, has_more_users, users_query.isFetchingNextPage, fetchMoreUsers])

  const clocks = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data])
  const total_ms = clocks.reduce((sum, clock) => sum + (clock.duration_ms ?? 0), 0)

  function renderContent() {
    if (!range) {
      return (
        <StateMessage
          description="Choose a valid start and end date to see entries."
          icon={ClockIcon}
          title="Select a date range"
        />
      )
    }
    if (isPending) {
      return (
        <Card aria-busy className="gap-3 p-5" role="status">
          <span className="sr-only">Loading clocks</span>
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton className="h-10 w-full" key={index} />
          ))}
        </Card>
      )
    }
    if (isError) {
      return (
        <StateMessage
          action={
            <Button
              onClick={() => {
                void refetch()
              }}
              variant="outline"
            >
              Try again
            </Button>
          }
          description={getErrorMessage(error)}
          icon={AlertCircleIcon}
          title="Could not load clocks"
        />
      )
    }
    if (clocks.length === 0) {
      return (
        <StateMessage
          description="No clock entries in this period."
          icon={ClockIcon}
          title="Nothing here yet"
        />
      )
    }
    return (
      <>
        <ClocksTable
          can_manage={can_manage}
          clocks={clocks}
          more={hasNextPage}
          onDelete={setDeleting}
          onEdit={setEditing}
          total_ms={total_ms}
        />
        {hasNextPage ? (
          <div className="flex justify-center">
            <Button
              disabled={isFetchingNextPage}
              onClick={() => {
                void fetchNextPage()
              }}
              variant="outline"
            >
              {isFetchingNextPage ? <Loader2Icon className="animate-spin" /> : null}
              Load more
            </Button>
          </div>
        ) : null}
      </>
    )
  }

  return (
    <>
      <PageHeader
        actions={
          can_manage ? <AddEntryButton default_user_id={target_id} users={user_options} /> : null
        }
        description={can_manage ? 'Review and correct the time of your team' : 'Your time entries'}
        title="Clocks"
      />
      <div className="flex flex-wrap items-end gap-4">
        {can_manage ? (
          <div className="space-y-1">
            <Label htmlFor="clocks-user">User</Label>
            <Select onValueChange={setSelectedUser} value={target_id}>
              <SelectTrigger className="w-56" id="clocks-user">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {user_options.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.id === own_id ? `${option.label} (me)` : option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <ClocksFilters
          custom_from={custom_from}
          custom_to={custom_to}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
          onPresetChange={setPreset}
          preset={preset}
        />
      </div>
      {renderContent()}
      {editing ? (
        <ManualEntryDialog
          clock={editing}
          default_user_id={editing.user_id}
          onOpenChange={(next) => {
            if (!next) setEditing(null)
          }}
          open
          users={user_options}
        />
      ) : null}
      {deleting ? (
        <DeleteEntryDialog
          clock={deleting}
          onClose={() => {
            setDeleting(null)
          }}
        />
      ) : null}
    </>
  )
}
