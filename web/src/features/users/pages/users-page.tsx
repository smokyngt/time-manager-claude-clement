import type { Role, User } from '@time-manager/sdk'

import { PlusIcon, UsersIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'

import type { UserFormValues } from '@/features/users/lib'

import {
  Announcer,
  ConfirmDialog,
  Empty,
  ErrorState,
  ListToolbar,
  PageHeader,
  Pagination,
  ResponsiveDetail,
  SearchInput,
} from '@/components/shared'
import { Button } from '@/components/ui/button'
import { LIMITS } from '@/config/limits'
import { QueryKeys } from '@/config/query-keys'
import {
  UserCard,
  UserDetails,
  UserForm,
  UserRow,
  UsersBulkToolbar,
  UsersFilters,
  UsersSkeleton,
} from '@/features/users/components'
import {
  useArchiveUser,
  useCreateUser,
  useDeleteUsers,
  useRestoreUser,
  useTeamOptions,
  useUpdateUsers,
  useUsers,
} from '@/features/users/hooks'
import { UserPayload, UserPermissions, UserSearch } from '@/features/users/lib'
import {
  useClearSelectionShortcut,
  useCursorPagination,
  useDebouncedValue,
  useDeleteShortcut,
  useDocumentTitle,
  useMultiParams,
  useMultiSelect,
  useOptimisticCache,
  useRovingTabindex,
  useSearchHotkey,
  useSelectAllShortcut,
  useUndo,
  useViewMode,
} from '@/hooks'
import { Errors } from '@/lib/errors'
import { Permission } from '@/lib/permission'
import { RESOURCE_SCOPES } from '@/lib/scopes'
import { useAuth } from '@/providers/use-auth'

type Panel =
  { kind: 'create' } | { kind: 'edit'; userId: string } | { kind: 'view'; userId: string }

type Confirm = { ids: string[]; kind: 'archive' | 'delete' }

const PARAM_DEFAULTS = { archived: false, role: 'all', teamId: '' }

function isRole(value: string): value is Role {
  return value === 'admin' || value === 'employee' || value === 'manager'
}

export function UsersPage() {
  const { user } = useAuth()

  if (user === null) {
    return null
  }

  return <UsersContent actor={{ id: user.id, role: user.role }} />
}

function UsersContent({ actor }: { actor: Pick<User, 'id' | 'role'> }) {
  const { t } = useTranslation('users')
  const { t: tc } = useTranslation('common')
  useDocumentTitle(t('title'))
  const navigate = useNavigate()
  const { scopes } = useAuth()
  const searchRef = useRef<HTMLInputElement>(null)
  const announced = useRef(0)

  const { set, values } = useMultiParams(PARAM_DEFAULTS)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const pagination = useCursorPagination()
  const selection = useMultiSelect()
  const { setViewMode, viewMode } = useViewMode('users', 'list')
  const [panel, setPanel] = useState<null | Panel>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)

  const isAdmin = actor.role === 'admin'
  const role = isAdmin && isRole(values.role) ? values.role : undefined
  const teamId = values.teamId === '' ? undefined : values.teamId
  const { error, fetching, isError, loaded, loading, more, next, refetch, total, users } = useUsers(
    {
      archived: values.archived,
      cursor: pagination.cursor,
      limit: LIMITS.pageSize.default,
      role,
      teamId,
    },
  )
  const { teams } = useTeamOptions()
  const create = useCreateUser()
  const update = useUpdateUsers()
  const archive = useArchiveUser()
  const restore = useRestoreUser()
  const remove = useDeleteUsers()
  const cache = useOptimisticCache<User>(QueryKeys.users())
  const undo = useUndo()

  const canManage = Permission.scope.any(scopes, [RESOURCE_SCOPES.users.manage])
  const canReport = Permission.scope.any(scopes, [RESOURCE_SCOPES.reports.read])
  const canCreate = canManage && UserPermissions.canCreate(actor)

  const visible = useMemo(() => UserSearch.filter(users, debouncedSearch), [users, debouncedSearch])
  const selectableIds = useMemo(
    () => visible.filter((item) => UserPermissions.canSelect(actor, item)).map((item) => item.id),
    [actor, visible],
  )
  const selectedUsers = useMemo(
    () => visible.filter((item) => selection.isSelected(item.id)),
    [selection, visible],
  )
  const deletableIds = useMemo(
    () =>
      selectedUsers.filter((item) => UserPermissions.canDelete(actor, item)).map((item) => item.id),
    [actor, selectedUsers],
  )
  const panelUser = useMemo(
    () =>
      panel && panel.kind !== 'create' ? users.find((item) => item.id === panel.userId) : undefined,
    [panel, users],
  )
  const dialogsClosed = panel === null && confirm === null
  const { prune } = selection
  const roving = useRovingTabindex(visible.length, { columns: viewMode === 'grid' ? 3 : 1 })

  useEffect(() => {
    prune(visible.map((item) => item.id))
  }, [prune, visible])

  useEffect(() => {
    if (announced.current === selection.count) {
      return
    }
    announced.current = selection.count
    Announcer.say(
      selection.count === 0
        ? tc('bulk.announce_cleared')
        : tc('bulk.selected', { count: selection.count }),
    )
  }, [selection.count, tc])

  const changeFilters = useCallback(
    (patch: Partial<typeof PARAM_DEFAULTS>) => {
      set(patch)
      pagination.reset()
      selection.clear()
    },
    [pagination, selection, set],
  )

  const requestArchive = useCallback((ids: string[]) => {
    setConfirm({ ids, kind: 'archive' })
  }, [])
  const requestDelete = useCallback((ids: string[]) => {
    setConfirm({ ids, kind: 'delete' })
  }, [])

  const handleRestore = useCallback(
    (ids: string[]) => {
      restore.mutate(ids, { onSettled: selection.clear })
    },
    [restore, selection.clear],
  )

  const deleteOptimistically = useCallback(
    async (ids: string[]) => {
      const snapshot = await cache.remove(ids)
      selection.clear()
      undo.deferAction({
        message: t('toast.deleted', { count: ids.length }),
        onCommit: () => {
          remove.mutate(ids)
        },
        onUndo: () => {
          cache.restore(snapshot)
        },
      })
    },
    [cache, remove, selection, t, undo],
  )

  const handleConfirm = useCallback(() => {
    if (!confirm) {
      return
    }
    setConfirm(null)
    if (confirm.kind === 'delete') {
      void deleteOptimistically(confirm.ids)
    } else {
      archive.mutate(confirm.ids, { onSettled: selection.clear })
    }
  }, [archive, confirm, deleteOptimistically, selection.clear])

  const handleView = useCallback((target: User) => {
    setPanel({ kind: 'view', userId: target.id })
  }, [])
  const handleEdit = useCallback(
    (target: User) => {
      update.reset()
      setPanel({ kind: 'edit', userId: target.id })
    },
    [update],
  )
  const handleArchive = useCallback(
    (target: User) => {
      requestArchive([target.id])
    },
    [requestArchive],
  )
  const handleRestoreOne = useCallback(
    (target: User) => {
      handleRestore([target.id])
    },
    [handleRestore],
  )
  const handleDelete = useCallback(
    (target: User) => {
      requestDelete([target.id])
    },
    [requestDelete],
  )
  const handleReport = useCallback(
    (target: User) => {
      void navigate(`/reports/users/${target.id}`)
    },
    [navigate],
  )
  const { toggle } = selection

  const openCreate = useCallback(() => {
    create.reset()
    setPanel({ kind: 'create' })
  }, [create])
  const closePanel = useCallback((open: boolean) => {
    if (!open) {
      setPanel(null)
    }
  }, [])

  const submitCreate = useCallback(
    (formValues: UserFormValues) => {
      create.mutate(UserPayload.create(formValues, actor), {
        onSuccess: () => {
          setPanel(null)
          pagination.reset()
        },
      })
    },
    [actor, create, pagination],
  )
  const submitEdit = useCallback(
    (formValues: UserFormValues) => {
      if (!panelUser) {
        return
      }
      const data = UserPayload.update(
        formValues,
        panelUser,
        UserPermissions.fields(actor, panelUser),
      )
      if (Object.keys(data).length === 0) {
        setPanel(null)
        return
      }
      update.mutate(
        { data, ids: [panelUser.id], revert: UserPayload.revert(panelUser, data) },
        {
          onSuccess: (result) => {
            if (result.failed.length === 0) {
              setPanel(null)
            }
          },
        },
      )
    },
    [actor, panelUser, update],
  )

  useSearchHotkey(searchRef)
  useSelectAllShortcut(
    () => {
      selection.selectAll(selectableIds)
    },
    dialogsClosed && selectableIds.length > 0,
  )
  useClearSelectionShortcut(selection.clear, dialogsClosed && selection.count > 0)
  useDeleteShortcut(
    () => {
      requestDelete(deletableIds)
    },
    dialogsClosed && deletableIds.length > 0,
  )

  const emailTaken =
    Errors.code.check(create.error, 'user.conflict') ||
    Errors.code.check(update.error, 'user.conflict') ||
    (update.data?.failed.some((item) => item.code === 'user.conflict') ?? false)
  const filtering =
    debouncedSearch !== '' || values.archived || role !== undefined || teamId !== undefined
  const busy = archive.isPending || restore.isPending
  const bulkArchive = !values.archived && selectedUsers.length > 0
  const ItemComponent = viewMode === 'grid' ? UserCard : UserRow

  let content
  if (loading) {
    content = <UsersSkeleton />
  } else if (isError) {
    content = <ErrorState error={error} onRetry={() => void refetch()} />
  } else if (loaded && visible.length === 0) {
    content = (
      <Empty
        action={
          canCreate && !filtering ? (
            <Button onClick={openCreate}>
              <PlusIcon aria-hidden />
              {t('actions.create')}
            </Button>
          ) : undefined
        }
        description={
          debouncedSearch
            ? tc('search.no_results', { query: debouncedSearch })
            : t(filtering ? 'empty.filtered' : 'empty.description')
        }
        icon={UsersIcon}
        title={t('empty.title')}
      />
    )
  } else {
    content = (
      <div
        aria-busy={fetching}
        aria-label={t('title')}
        className={viewMode === 'grid' ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3' : 'grid gap-2'}
        role="list"
      >
        {visible.map((item, index) => (
          <ItemComponent
            actor={actor}
            getItemProps={roving.getItemProps}
            index={index}
            key={item.id}
            onArchive={canManage ? handleArchive : undefined}
            onDelete={canManage ? handleDelete : undefined}
            onEdit={canManage ? handleEdit : undefined}
            onRestore={canManage ? handleRestoreOne : undefined}
            onSelect={canManage ? toggle : undefined}
            onView={handleView}
            onViewReport={canReport ? handleReport : undefined}
            selected={selection.isSelected(item.id)}
            user={item}
          />
        ))}
      </div>
    )
  }

  const confirmCount = confirm?.ids.length ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          canCreate ? (
            <Button onClick={openCreate}>
              <PlusIcon aria-hidden />
              {t('actions.create')}
            </Button>
          ) : undefined
        }
        description={t('description')}
        title={t('title')}
      />
      <ListToolbar
        filters={
          <UsersFilters onChange={changeFilters} showRole={isAdmin} teams={teams} value={values} />
        }
        onViewModeChange={setViewMode}
        search={
          <SearchInput
            inputRef={searchRef}
            label={t('search.label')}
            onChange={setSearch}
            placeholder={t('search.placeholder')}
            value={search}
          />
        }
        viewMode={viewMode}
      />
      <UsersBulkToolbar
        count={selection.count}
        disabled={busy}
        onArchive={
          canManage && bulkArchive
            ? () => {
                requestArchive(selection.ids)
              }
            : undefined
        }
        onClear={selection.clear}
        onDelete={
          deletableIds.length > 0
            ? () => {
                requestDelete(deletableIds)
              }
            : undefined
        }
        onRestore={
          canManage && values.archived && selection.count > 0
            ? () => {
                handleRestore(selection.ids)
              }
            : undefined
        }
        onSelectAll={() => {
          selection.selectAll(selectableIds)
        }}
      />
      {content}
      <Pagination
        hasNext={more}
        hasPrevious={pagination.hasPrevious}
        onNext={() => {
          pagination.next(next)
          selection.clear()
        }}
        onPrevious={() => {
          pagination.previous()
          selection.clear()
        }}
        page={pagination.page}
        total={total}
      />
      <ResponsiveDetail
        onOpenChange={closePanel}
        open={panel !== null}
        title={
          panel?.kind === 'create'
            ? t('create.title')
            : panel?.kind === 'edit'
              ? t('edit.title')
              : panelUser
                ? UserSearch.name(panelUser)
                : t('detail.title')
        }
      >
        {panel?.kind === 'create' ? (
          <UserForm
            actor={actor}
            emailTaken={emailTaken}
            idPrefix="create-user"
            onCancel={() => {
              setPanel(null)
            }}
            onSubmit={submitCreate}
            pending={create.isPending}
          />
        ) : null}
        {panel?.kind === 'edit' && panelUser ? (
          <UserForm
            actor={actor}
            emailTaken={emailTaken}
            idPrefix="edit-user"
            key={panelUser.id}
            onCancel={() => {
              setPanel(null)
            }}
            onSubmit={submitEdit}
            pending={update.isPending}
            user={panelUser}
          />
        ) : null}
        {panel?.kind === 'view' && panelUser ? (
          <div className="space-y-4">
            <UserDetails user={panelUser} />
            <div className="flex justify-end">
              <Button asChild variant="outline">
                <Link to={`/users/${panelUser.id}`}>{t('actions.open_page')}</Link>
              </Button>
            </div>
          </div>
        ) : null}
      </ResponsiveDetail>
      <ConfirmDialog
        confirmLabel={confirm?.kind === 'delete' ? tc('actions.delete') : tc('actions.archive')}
        description={t(confirm?.kind === 'delete' ? 'delete.description' : 'archive.description', {
          count: confirmCount,
        })}
        loading={busy}
        onConfirm={handleConfirm}
        onOpenChange={(open) => {
          if (!open) {
            setConfirm(null)
          }
        }}
        open={confirm !== null}
        title={t(confirm?.kind === 'delete' ? 'delete.title' : 'archive.title', {
          count: confirmCount,
        })}
        variant={confirm?.kind === 'delete' ? 'destructive' : 'default'}
      />
    </div>
  )
}
