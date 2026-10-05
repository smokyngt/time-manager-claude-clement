import type { Team } from '@time-manager/sdk'

import { PlusIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Announcer } from '@/components/shared/announcer'
import { BulkActionBar } from '@/components/shared/bulk-action-bar'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { ErrorState } from '@/components/shared/error-state'
import { ListToolbar } from '@/components/shared/list-toolbar'
import { PageHeader } from '@/components/shared/page-header'
import { Pagination } from '@/components/shared/pagination'
import { ResponsiveDetail } from '@/components/shared/responsive-detail'
import { SearchInput } from '@/components/shared/search-input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { QueryKeys } from '@/config/query-keys'
import { TeamDetails } from '@/features/teams/components/team-details'
import { TeamFormDialog } from '@/features/teams/components/team-form-dialog'
import { TeamList } from '@/features/teams/components/team-list'
import { useArchiveTeam } from '@/features/teams/hooks/use-archive-team'
import { useCreateTeam } from '@/features/teams/hooks/use-create-team'
import { useDeleteTeam } from '@/features/teams/hooks/use-delete-team'
import { useRestoreTeam } from '@/features/teams/hooks/use-restore-team'
import { useTeamHistory } from '@/features/teams/hooks/use-team-history'
import { useTeams } from '@/features/teams/hooks/use-teams'
import { useUpdateTeam } from '@/features/teams/hooks/use-update-team'
import { useUserOptions } from '@/features/teams/hooks/use-user-options'
import { TeamFormat } from '@/features/teams/lib/team-format'
import { TeamMapper } from '@/features/teams/lib/team-mapper'
import { TeamPermission } from '@/features/teams/lib/team-permission'
import { TeamRoles } from '@/features/teams/lib/team-roles'
import {
  useClearSelectionShortcut,
  useDebouncedValue,
  useDeleteShortcut,
  useDocumentTitle,
  useListPagination,
  useMultiParams,
  useMultiSelect,
  useOptimisticCache,
  useSearchHotkey,
  useSelectAllShortcut,
  useUndo,
  useViewMode,
} from '@/hooks'
import { useAuth } from '@/providers/use-auth'

const FILTER_DEFAULTS: Record<string, boolean | number | string> = { archived: false, order: 'desc' }

export function TeamsPage() {
  const { t } = useTranslation('teams')
  useDocumentTitle(t('title'))

  const { scopes, user } = useAuth()
  const { set: setParams, values } = useMultiParams(FILTER_DEFAULTS)
  const archived = values.archived === true
  const order = values.order === 'asc' ? 'asc' : 'desc'
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const searchRef = useRef<HTMLInputElement>(null)
  const { setViewMode, viewMode } = useViewMode('teams')
  const selection = useMultiSelect()
  const previousCount = useRef(0)
  const [editing, setEditing] = useState<null | Team>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [previewId, setPreviewId] = useState<null | string>(null)
  const [pendingDelete, setPendingDelete] = useState<null | string[]>(null)

  const { error, isError, loading, refetch, teams } = useTeams({ archived, order })
  const managers = useUserOptions(TeamRoles.managers())
  const { createTeam, creating } = useCreateTeam()
  const { updateTeam, updating } = useUpdateTeam()
  const { archiveTeams } = useArchiveTeam()
  const { restoreTeams } = useRestoreTeam()
  const { deleteTeamsAsync } = useDeleteTeam()
  const cache = useOptimisticCache<Team>(QueryKeys.teams())
  const undo = useUndo()
  const history = useTeamHistory()

  const canCreate = TeamPermission.canCreate(scopes)
  const canDelete = TeamPermission.canDelete(scopes, user)
  const canPickManager = TeamPermission.canPickManager(user)

  const filtered = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase()
    return query === '' ? teams : teams.filter((team) => team.name.toLowerCase().includes(query))
  }, [debouncedSearch, teams])
  const pagination = useListPagination(filtered.length)
  const { limit, reset: resetPage, skip } = pagination
  const pageTeams = useMemo(() => filtered.slice(skip, skip + limit), [filtered, limit, skip])

  const managerNames = useMemo(
    () =>
      Object.fromEntries(managers.users.map((manager) => [manager.id, TeamFormat.userName(manager)])),
    [managers.users],
  )
  const isManageable = useCallback(
    (team: Team) => TeamPermission.canManage(scopes, user, team),
    [scopes, user],
  )
  const selectedIds = useMemo(
    () => pageTeams.filter((team) => selection.isSelected(team.id)).map((team) => team.id),
    [pageTeams, selection],
  )
  const previewTeam = useMemo(
    () => teams.find((team) => team.id === previewId),
    [previewId, teams],
  )

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value)
      resetPage()
      selection.clear()
    },
    [resetPage, selection],
  )
  const handleArchivedChange = useCallback(
    (value: string) => {
      setParams({ archived: value === 'archived' })
      resetPage()
      selection.clear()
    },
    [resetPage, selection, setParams],
  )
  const handleOrderChange = useCallback(
    (value: string) => {
      setParams({ order: value })
      resetPage()
    },
    [resetPage, setParams],
  )
  const openCreate = useCallback(() => {
    setEditing(null)
    setFormOpen(true)
  }, [])
  const openEdit = useCallback((team: Team) => {
    setEditing(team)
    setFormOpen(true)
  }, [])
  const closeForm = useCallback(() => {
    setFormOpen(false)
  }, [])
  const handleArchive = useCallback(
    (team: Team) => {
      archiveTeams([team.id])
    },
    [archiveTeams],
  )
  const handleRestore = useCallback(
    (team: Team) => {
      restoreTeams([team.id])
    },
    [restoreTeams],
  )
  const handleDelete = useCallback((team: Team) => {
    setPendingDelete([team.id])
  }, [])
  const handlePreview = useCallback((team: Team) => {
    setPreviewId(team.id)
  }, [])

  const handleSubmit = useCallback(
    (values: Parameters<typeof TeamMapper.toCreate>[0]) => {
      if (editing) {
        const data = TeamMapper.toUpdate(values, editing, canPickManager)
        const before = TeamMapper.snapshot(editing, canPickManager)
        updateTeam(
          { data, ids: [editing.id] },
          {
            onSuccess: () => {
              closeForm()
              undo.push(history.updated(editing, before, data))
            },
          },
        )
        return
      }
      createTeam(TeamMapper.toCreate(values, canPickManager), {
        onSuccess: ({ team }) => {
          closeForm()
          undo.push(history.created(team))
        },
      })
    },
    [canPickManager, closeForm, createTeam, editing, history, undo, updateTeam],
  )

  const confirmDelete = useCallback(async () => {
    const ids = pendingDelete
    setPendingDelete(null)
    if (ids === null) {
      return
    }
    selection.clear()
    const previous = await cache.remove(ids)
    undo.deferAction({
      message: t('toast.delete_pending', { count: ids.length }),
      onCommit: async () => {
        try {
          await deleteTeamsAsync(ids)
        } catch {
          cache.restore(previous)
        }
      },
      onUndo: () => {
        cache.restore(previous)
      },
    })
  }, [cache, deleteTeamsAsync, pendingDelete, selection, t, undo])

  const handleBulkArchive = useCallback(() => {
    archiveTeams(selectedIds, { onSuccess: selection.clear })
  }, [archiveTeams, selectedIds, selection.clear])
  const handleBulkRestore = useCallback(() => {
    restoreTeams(selectedIds, { onSuccess: selection.clear })
  }, [restoreTeams, selectedIds, selection.clear])

  const selectableIds = useMemo(
    () => pageTeams.filter(isManageable).map((team) => team.id),
    [isManageable, pageTeams],
  )
  const selectAll = useCallback(() => {
    selection.selectAll(selectableIds)
  }, [selectableIds, selection])

  useSearchHotkey(searchRef)
  useSelectAllShortcut(selectAll, selectableIds.length > 0)
  useClearSelectionShortcut(selection.clear, selectedIds.length > 0)
  useDeleteShortcut(
    () => {
      setPendingDelete(selectedIds)
    },
    canDelete && selectedIds.length > 0 && pendingDelete === null && !formOpen,
  )

  useEffect(() => {
    if (selectedIds.length > 0) {
      Announcer.say(t('common:bulk.selected', { count: selectedIds.length }))
    } else if (previousCount.current > 0) {
      Announcer.say(t('common:bulk.announce_cleared'))
    }
    previousCount.current = selectedIds.length
  }, [selectedIds.length, t])

  const searching = debouncedSearch.trim() !== ''
  const createButton = canCreate ? (
    <Button onClick={openCreate}>
      <PlusIcon />
      {t('actions.new')}
    </Button>
  ) : undefined

  return (
    <div className="space-y-6">
      <PageHeader description={t('description')} title={t('title')} />
      <ListToolbar
        actions={createButton}
        filters={
          <>
            <Select onValueChange={handleArchivedChange} value={archived ? 'archived' : 'active'}>
              <SelectTrigger aria-label={t('filters.status')} className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t('filters.active')}</SelectItem>
                <SelectItem value="archived">{t('filters.archived')}</SelectItem>
              </SelectContent>
            </Select>
            <Select onValueChange={handleOrderChange} value={order}>
              <SelectTrigger aria-label={t('filters.order')} className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">{t('filters.newest')}</SelectItem>
                <SelectItem value="asc">{t('filters.oldest')}</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        onViewModeChange={setViewMode}
        search={
          <SearchInput
            inputRef={searchRef}
            label={t('search.label')}
            onChange={handleSearch}
            placeholder={t('search.placeholder')}
            value={search}
          />
        }
        viewMode={viewMode}
      />
      <BulkActionBar
        count={selectedIds.length}
        onClear={selection.clear}
        onSelectAll={selectAll}
      >
        {archived ? (
          <Button onClick={handleBulkRestore} size="sm" variant="outline">
            {t('common:actions.restore')}
          </Button>
        ) : (
          <Button onClick={handleBulkArchive} size="sm" variant="outline">
            {t('common:actions.archive')}
          </Button>
        )}
        {canDelete ? (
          <Button
            onClick={() => {
              setPendingDelete(selectedIds)
            }}
            size="sm"
            variant="destructive"
          >
            {t('common:actions.delete')}
          </Button>
        ) : null}
      </BulkActionBar>
      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <TeamList
          emptyAction={searching || archived ? undefined : createButton}
          emptyDescription={
            searching
              ? t('common:search.no_results', { query: debouncedSearch.trim() })
              : archived
                ? t('empty.archived_description')
                : t('empty.description')
          }
          emptyTitle={archived && !searching ? t('empty.archived_title') : undefined}
          isManageable={isManageable}
          loading={loading}
          managerNames={managerNames}
          onArchive={handleArchive}
          onDelete={canDelete ? handleDelete : undefined}
          onEdit={openEdit}
          onPreview={handlePreview}
          onRestore={handleRestore}
          onToggle={selection.toggle}
          selectedIds={selection.selected}
          teams={pageTeams}
          viewMode={viewMode}
        />
      )}
      <Pagination
        hasNext={pagination.hasNext}
        hasPrevious={pagination.hasPrevious}
        onNext={pagination.next}
        onPrevious={pagination.previous}
        page={pagination.page}
        pages={pagination.pages}
        total={filtered.length}
      />
      {user ? (
        <TeamFormDialog
          canPickManager={canPickManager}
          defaultManagerId={user.id}
          managers={managers.users}
          managersLoading={managers.loading}
          onOpenChange={setFormOpen}
          onSubmit={handleSubmit}
          open={formOpen}
          submitting={creating || updating}
          team={editing ?? undefined}
        />
      ) : null}
      <ConfirmDialog
        confirmLabel={t('common:actions.delete')}
        description={t('delete.description', { count: pendingDelete?.length ?? 0 })}
        onConfirm={() => void confirmDelete()}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null)
          }
        }}
        open={pendingDelete !== null}
        title={t('delete.title', { count: pendingDelete?.length ?? 0 })}
        variant="destructive"
      />
      <ResponsiveDetail
        onOpenChange={(open) => {
          if (!open) {
            setPreviewId(null)
          }
        }}
        open={previewTeam !== undefined}
        title={previewTeam?.name ?? ''}
      >
        {previewTeam ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {previewTeam.description ?? t('detail.no_description')}
            </p>
            <TeamDetails managerName={managerNames[previewTeam.managerId]} team={previewTeam} />
            <Button asChild>
              <Link to={`/teams/${previewTeam.id}`}>{t('actions.open')}</Link>
            </Button>
          </div>
        ) : null}
      </ResponsiveDetail>
    </div>
  )
}
