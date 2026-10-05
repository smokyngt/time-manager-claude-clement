import { ArchiveIcon, ArchiveRestoreIcon, Trash2Icon } from 'lucide-react'
import { useNavigate } from 'react-router'

import type { Team } from '@/features/teams/api/types'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/features/teams/components/confirm-dialog'
import { EditTeamDialog } from '@/features/teams/components/edit-team-dialog'
import { useArchiveTeam, useDeleteTeam, useRestoreTeam } from '@/features/teams/hooks/use-teams'
import { canDeleteTeam, canManageTeam } from '@/features/teams/permissions'
import { useAuth } from '@/lib/auth/use-auth'

export function TeamActions({ team }: { team: Team }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const archive = useArchiveTeam()
  const restore = useRestoreTeam()
  const remove = useDeleteTeam()
  const can_manage = canManageTeam(user, team)

  if (!can_manage) return null

  return (
    <>
      {team.archived_at ? null : <EditTeamDialog team={team} />}
      {team.archived_at ? (
        <Button
          disabled={restore.isPending}
          onClick={() => {
            restore.mutate(team.id)
          }}
          variant="outline"
        >
          <ArchiveRestoreIcon />
          Restore
        </Button>
      ) : (
        <ConfirmDialog
          confirm_label="Archive"
          description="Archived teams are hidden from the default list. You can restore it later."
          on_confirm={() => {
            archive.mutate(team.id)
          }}
          title={`Archive ${team.name}?`}
          trigger={
            <Button variant="outline">
              <ArchiveIcon />
              Archive
            </Button>
          }
        />
      )}
      {canDeleteTeam(user) ? (
        <ConfirmDialog
          confirm_label="Delete"
          description="This permanently deletes the team and its memberships. This cannot be undone."
          destructive
          on_confirm={() => {
            remove.mutate(team.id, {
              onSuccess: (result) => {
                if (result.failed === 0) void navigate('/teams')
              },
            })
          }}
          title={`Delete ${team.name}?`}
          trigger={
            <Button variant="destructive">
              <Trash2Icon />
              Delete
            </Button>
          }
        />
      ) : null}
    </>
  )
}
