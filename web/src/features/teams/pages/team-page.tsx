import type { TeamMember } from '@time-manager/sdk'

import { ArrowLeftIcon, UserPlusIcon } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'

import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AddMembersDialog } from '@/features/teams/components/add-members-dialog'
import { MembersTable } from '@/features/teams/components/members-table'
import { TeamActions } from '@/features/teams/components/team-actions'
import { TeamDetails } from '@/features/teams/components/team-details'
import { TeamFormDialog } from '@/features/teams/components/team-form-dialog'
import { useAddMembers } from '@/features/teams/hooks/use-add-members'
import { useArchiveTeam } from '@/features/teams/hooks/use-archive-team'
import { useDeleteTeam } from '@/features/teams/hooks/use-delete-team'
import { useRemoveMembers } from '@/features/teams/hooks/use-remove-members'
import { useRestoreTeam } from '@/features/teams/hooks/use-restore-team'
import { useTeam } from '@/features/teams/hooks/use-team'
import { useTeamHistory } from '@/features/teams/hooks/use-team-history'
import { useTeamMembers } from '@/features/teams/hooks/use-team-members'
import { useUpdateTeam } from '@/features/teams/hooks/use-update-team'
import { useUserOptions } from '@/features/teams/hooks/use-user-options'
import { TeamFormat } from '@/features/teams/lib/team-format'
import { TeamMapper } from '@/features/teams/lib/team-mapper'
import { TeamPermission } from '@/features/teams/lib/team-permission'
import { TeamRoles } from '@/features/teams/lib/team-roles'
import { useDocumentTitle, useUndo } from '@/hooks'
import { useAuth } from '@/providers/use-auth'

export function TeamPage() {
  const { t } = useTranslation('teams')
  const { teamId = '' } = useParams()
  const { scopes, user } = useAuth()
  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [removing, setRemoving] = useState<null | TeamMember>(null)

  const { error, isError, loading, refetch, team } = useTeam(teamId)
  useDocumentTitle(team?.name ?? t('title'))

  const canManage = team !== undefined && TeamPermission.canManage(scopes, user, team)
  const active = team !== undefined && team.archivedAt === null
  const canDelete = TeamPermission.canDelete(scopes, user)
  const canPickManager = TeamPermission.canPickManager(user)

  const members = useTeamMembers(teamId)
  const managers = useUserOptions(TeamRoles.managers())
  const candidates = useUserOptions(TeamRoles.memberCandidates(user?.role), addOpen && canManage)
  const { updateTeam, updating } = useUpdateTeam()
  const { archiveTeams } = useArchiveTeam()
  const { restoreTeams } = useRestoreTeam()
  const { deleteTeams, deleting } = useDeleteTeam({ navigateTo: '/teams' })
  const { addMembers, adding } = useAddMembers(teamId)
  const { removeMembers, removing: removingPending } = useRemoveMembers(teamId)
  const undo = useUndo()
  const history = useTeamHistory()

  const memberIds = useMemo(() => new Set(members.members.map((member) => member.id)), [members.members])
  const managerName = useMemo(() => {
    const manager = managers.users.find((candidate) => candidate.id === team?.managerId)
    return manager ? TeamFormat.userName(manager) : undefined
  }, [managers.users, team?.managerId])

  const handleSubmit = useCallback(
    (values: Parameters<typeof TeamMapper.toUpdate>[0]) => {
      if (!team) {
        return
      }
      const data = TeamMapper.toUpdate(values, team, canPickManager)
      const before = TeamMapper.snapshot(team, canPickManager)
      updateTeam(
        { data, ids: [team.id] },
        {
          onSuccess: () => {
            setEditOpen(false)
            undo.push(history.updated(team, before, data))
          },
        },
      )
    },
    [canPickManager, history, team, undo, updateTeam],
  )

  const back = (
    <Button asChild className="w-fit" variant="ghost">
      <Link to="/teams">
        <ArrowLeftIcon />
        {t('actions.back')}
      </Link>
    </Button>
  )

  if (loading) {
    return (
      <div className="space-y-4">
        {back}
        <div aria-busy className="space-y-4" role="status">
          <span className="sr-only">{t('common:state.loading')}</span>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  if (isError || !team) {
    const missing = Errors404.is(error)
    return (
      <div className="space-y-4">
        {back}
        <ErrorState
          description={missing ? t('error.not_found_description') : undefined}
          error={error}
          onRetry={missing ? undefined : () => void refetch()}
          title={missing ? t('error.not_found_title') : t('error.title')}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {back}
      <PageHeader
        actions={
          <TeamActions
            dashboardTo={canManage ? `/teams/${team.id}/dashboard` : undefined}
            onArchive={
              canManage && active
                ? () => {
                    archiveTeams([team.id])
                  }
                : undefined
            }
            onDelete={
              canDelete
                ? () => {
                    setDeleteOpen(true)
                  }
                : undefined
            }
            onEdit={
              canManage && active
                ? () => {
                    setEditOpen(true)
                  }
                : undefined
            }
            onRestore={
              canManage && !active
                ? () => {
                    restoreTeams([team.id])
                  }
                : undefined
            }
          />
        }
        description={team.description ?? t('detail.no_description')}
        title={team.name}
      />
      {active ? null : <Badge variant="outline">{t('card.archived')}</Badge>}
      <Card>
        <CardContent>
          <TeamDetails managerName={managerName} team={team} />
        </CardContent>
      </Card>
      <section aria-labelledby="members-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight" id="members-heading">
            {t('members.title')}
          </h2>
          {canManage && active ? (
            <Button
              onClick={() => {
                setAddOpen(true)
              }}
            >
              <UserPlusIcon />
              {t('members.add.open')}
            </Button>
          ) : null}
        </div>
        {members.isError ? (
          <ErrorState error={members.error} onRetry={() => void members.refetch()} />
        ) : (
          <MembersTable
            loading={members.loading}
            members={members.members}
            onRemove={canManage && active ? setRemoving : undefined}
          />
        )}
      </section>
      {user ? (
        <TeamFormDialog
          canPickManager={canPickManager}
          defaultManagerId={user.id}
          managers={managers.users}
          managersLoading={managers.loading}
          onOpenChange={setEditOpen}
          onSubmit={handleSubmit}
          open={editOpen}
          submitting={updating}
          team={team}
        />
      ) : null}
      <AddMembersDialog
        candidates={candidates.users}
        error={candidates.error}
        isError={candidates.isError}
        loading={candidates.loading}
        memberIds={memberIds}
        onOpenChange={setAddOpen}
        onRetry={() => void candidates.refetch()}
        onSubmit={(userIds) => {
          addMembers(userIds, {
            onSuccess: () => {
              setAddOpen(false)
            },
          })
        }}
        open={addOpen}
        submitting={adding}
      />
      <ConfirmDialog
        confirmLabel={t('common:actions.remove')}
        description={t('members.remove.description')}
        loading={removingPending}
        onConfirm={() => {
          if (removing) {
            removeMembers([removing.id], {
              onSuccess: () => {
                setRemoving(null)
              },
            })
          }
        }}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null)
          }
        }}
        open={removing !== null}
        title={t('members.remove.title_named', { name: removing ? TeamFormat.userName(removing) : '' })}
        variant="destructive"
      />
      <ConfirmDialog
        confirmLabel={t('common:actions.delete')}
        description={t('delete.description', { count: 1 })}
        loading={deleting}
        onConfirm={() => {
          deleteTeams([team.id])
        }}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        title={t('delete.title', { count: 1 })}
        variant="destructive"
      />
    </div>
  )
}
