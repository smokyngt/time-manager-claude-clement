import type { Clock } from '@time-manager/sdk'

import { ClockIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Announcer } from '@/components/shared/announcer'
import { BulkActionBar } from '@/components/shared/bulk-action-bar'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Empty } from '@/components/shared/empty'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Pagination } from '@/components/shared/pagination'
import { ResponsiveDetail } from '@/components/shared/responsive-detail'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { QueryKeys } from '@/config/query-keys'
import { ClockForm } from '@/features/clocks/components/clock-form'
import { ClocksTable } from '@/features/clocks/components/clocks-table'
import { ClocksToolbar } from '@/features/clocks/components/clocks-toolbar'
import { useClockUsers } from '@/features/clocks/hooks/use-clock-users'
import { useClocks } from '@/features/clocks/hooks/use-clocks'
import { useCreateClock } from '@/features/clocks/hooks/use-create-clock'
import { useDeleteClocks } from '@/features/clocks/hooks/use-delete-clocks'
import { useUpdateClock } from '@/features/clocks/hooks/use-update-clock'
import { ClockRange } from '@/features/clocks/lib/clock-range'
import { ClockValues } from '@/features/clocks/lib/clock-values'
import type { ClockEntry } from '@/features/clocks/lib/clock-values'
import { useCursorPagination } from '@/hooks/use-cursor-pagination'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useMultiParams } from '@/hooks/use-multi-params'
import { useMultiSelect } from '@/hooks/use-multi-select'
import { useOptimisticCache } from '@/hooks/use-optimistic-cache'
import {
  useClearSelectionShortcut,
  useDeleteShortcut,
  useSelectAllShortcut,
} from '@/hooks/use-shortcuts'
import { useUndo } from '@/hooks/use-undo'
import { Permission } from '@/lib/permission'
import { RESOURCE_SCOPES } from '@/lib/scopes'
import { useAuth } from '@/providers/use-auth'
import { useToastActions } from '@/providers/use-toast-actions'

const DEFAULTS = { from: '', preset: 'this_week', to: '', user: '' }

const CLOCKS_KEY = QueryKeys.clocks()

const SKELETON_ROWS = [0, 1, 2, 3, 4]

type FormState = { clock: Clock | null } | null

export function ClocksPage() {
  const { t } = useTranslation('clocks')
  const { t: tc } = useTranslation('common')
  useDocumentTitle(t('title'))

  const { scopes, user } = useAuth()
  const toasts = useToastActions()
  const { deferAction } = useUndo()
  const ownId = user?.id ?? ''
  const canManage = Permission.scope.any(scopes, [RESOURCE_SCOPES.clocks.manage])

  const { set, values } = useMultiParams(DEFAULTS)
  const pagination = useCursorPagination()
  const { clear, count, ids, prune, selectAll, selected, toggle } = useMultiSelect()
  const [form, setForm] = useState<FormState>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const preset = ClockRange.parse(values.preset)
  const targetId = canManage && values.user !== '' ? values.user : ownId
  const range = useMemo(
    () => ClockRange.resolve(preset, values.from, values.to, Date.now()),
    [preset, values.from, values.to],
  )
  const invalidRange = range === null

  const { users } = useClockUsers(canManage)
  const { clocks, error, isError, loading, more, next, refetch, total } = useClocks(
    {
      cursor: pagination.cursor,
      from: range?.from,
      to: range?.to,
      userIds: canManage ? [targetId] : undefined,
    },
    !invalidRange && ownId !== '',
  )
  const { create, pending: creating } = useCreateClock()
  const { pending: updating, update } = useUpdateClock()
  const { deleteClocks } = useDeleteClocks()
  const cache = useOptimisticCache<Clock>(CLOCKS_KEY)

  const clockIds = useMemo(() => clocks.map((clock) => clock.id), [clocks])
  const totalMs = useMemo(
    () => clocks.reduce((sum, clock) => sum + (clock.durationMs ?? 0), 0),
    [clocks],
  )
  const allSelected = clocks.length > 0 && count === clocks.length

  useEffect(() => {
    prune(clockIds)
  }, [clockIds, prune])

  const previousCount = useRef(0)
  useEffect(() => {
    if (count > 0) {
      Announcer.say(t('bulk.selected', { count }))
    } else if (previousCount.current > 0) {
      Announcer.say(tc('bulk.announce_cleared'))
    }
    previousCount.current = count
  }, [count, t, tc])

  const changeFilters = useCallback(
    (patch: Partial<typeof DEFAULTS>) => {
      set(patch)
      pagination.reset()
      clear()
    },
    [clear, pagination, set],
  )

  const removeClocks = useCallback(
    async (target: string[]) => {
      const previous = await cache.remove(target)
      clear()
      deferAction({
        message: t('delete.message', { count: target.length }),
        onCommit: () => {
          deleteClocks(target, {
            onError: () => {
              cache.restore(previous)
            },
            onSuccess: (result) => {
              if (result.failed.length > 0) {
                cache.restore(previous)
                toasts.showError(t('title'), t('delete.failed'))
              }
            },
          })
        },
        onUndo: () => {
          cache.restore(previous)
        },
      })
    },
    [cache, clear, deferAction, deleteClocks, t, toasts],
  )

  const handleDelete = useCallback(
    (clock: Clock) => {
      void removeClocks([clock.id])
    },
    [removeClocks],
  )
  const handleEdit = useCallback((clock: Clock) => {
    setForm({ clock })
  }, [])
  const openCreate = useCallback(() => {
    setForm({ clock: null })
  }, [])
  const handleToggleAll = useCallback(() => {
    if (allSelected) {
      clear()
    } else {
      selectAll(clockIds)
    }
  }, [allSelected, clear, clockIds, selectAll])
  const confirmBulk = useCallback(() => {
    if (count > 0) {
      setConfirmOpen(true)
    }
  }, [count])
  const handleBulkDelete = useCallback(() => {
    setConfirmOpen(false)
    void removeClocks(ids)
  }, [ids, removeClocks])

  const handleSubmit = useCallback(
    (entry: ClockEntry) => {
      const closeOnSuccess = {
        onSuccess: () => {
          setForm(null)
        },
      }
      if (form?.clock) {
        update(
          { clock: form.clock, entry },
          {
            onSuccess: (result) => {
              if (result.success) {
                setForm(null)
              }
            },
          },
        )
      } else {
        create(entry, closeOnSuccess)
      }
    },
    [create, form, update],
  )

  const shortcutsEnabled = canManage && form === null && !confirmOpen
  useDeleteShortcut(confirmBulk, shortcutsEnabled && count > 0)
  useSelectAllShortcut(() => {
    selectAll(clockIds)
  }, shortcutsEnabled)
  useClearSelectionShortcut(clear, shortcutsEnabled)

  function renderContent() {
    if (invalidRange) {
      return (
        <Empty
          description={t('invalid_range.description')}
          icon={ClockIcon}
          title={t('invalid_range.title')}
        />
      )
    }
    if (loading) {
      return (
        <div aria-busy className="space-y-2" role="status">
          <span className="sr-only">{tc('state.loading')}</span>
          {SKELETON_ROWS.map((row) => (
            <Skeleton className="h-10 w-full" key={row} />
          ))}
        </div>
      )
    }
    if (isError) {
      return (
        <ErrorState
          error={error}
          onRetry={() => {
            void refetch()
          }}
          title={t('error.title')}
        />
      )
    }
    if (clocks.length === 0) {
      return (
        <Empty description={t('empty.description')} icon={ClockIcon} title={t('empty.title')} />
      )
    }
    return (
      <ClocksTable
        allSelected={allSelected}
        clocks={clocks}
        onDelete={canManage ? handleDelete : undefined}
        onEdit={canManage ? handleEdit : undefined}
        onToggle={canManage ? toggle : undefined}
        onToggleAll={canManage ? handleToggleAll : undefined}
        selectedIds={selected}
        someSelected={count > 0}
        totalMs={totalMs}
      />
    )
  }

  const formValues = form?.clock ? ClockValues.fromClock(form.clock) : ClockValues.empty(targetId)

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          canManage ? (
            <Button className="pointer-coarse:h-11" onClick={openCreate}>
              <PlusIcon aria-hidden />
              {t('actions.add')}
            </Button>
          ) : undefined
        }
        description={canManage ? t('description_team') : t('description_own')}
        title={t('title')}
      />
      <ClocksToolbar
        from={values.from}
        invalid={preset === 'custom' && values.from !== '' && values.to !== '' && invalidRange}
        onFromChange={(value) => {
          changeFilters({ from: value })
        }}
        onPresetChange={(value) => {
          changeFilters({ preset: value })
        }}
        onToChange={(value) => {
          changeFilters({ to: value })
        }}
        onUserChange={
          canManage
            ? (value) => {
                changeFilters({ user: value })
              }
            : undefined
        }
        ownId={ownId}
        preset={preset}
        to={values.to}
        userId={targetId}
        users={users}
      />
      {canManage ? (
        <BulkActionBar count={count} onClear={clear} onSelectAll={handleToggleAll}>
          <Button onClick={confirmBulk} size="sm" variant="destructive">
            <Trash2Icon aria-hidden />
            {t('actions.delete_selected')}
          </Button>
        </BulkActionBar>
      ) : null}
      {renderContent()}
      <Pagination
        hasNext={more}
        hasPrevious={pagination.hasPrevious}
        onNext={() => {
          pagination.next(next)
          clear()
        }}
        onPrevious={() => {
          pagination.previous()
          clear()
        }}
        page={pagination.page}
        total={total}
      />
      <ResponsiveDetail
        onOpenChange={(open) => {
          if (!open) {
            setForm(null)
          }
        }}
        open={form !== null}
        title={form?.clock ? t('edit.title') : t('create.title')}
      >
        {form ? (
          <ClockForm
            defaultValues={formValues}
            editing={form.clock !== null}
            onSubmit={handleSubmit}
            pending={creating || updating}
            users={users}
          />
        ) : null}
      </ResponsiveDetail>
      <ConfirmDialog
        confirmLabel={t('bulk.confirm')}
        description={t('bulk.description')}
        onConfirm={handleBulkDelete}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        title={t('bulk.title', { count })}
        variant="destructive"
      />
    </div>
  )
}
