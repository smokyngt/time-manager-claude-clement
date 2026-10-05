import { PencilIcon } from 'lucide-react'

import type { Team } from '@/features/teams/api/types'
import type { TeamValues } from '@/features/teams/team-schema'

import { Button } from '@/components/ui/button'
import { TeamDialog } from '@/features/teams/components/team-dialog'
import { useUpdateTeam } from '@/features/teams/hooks/use-teams'
import { teamToValues, toUpdateData } from '@/features/teams/team-schema'
import { useAuth } from '@/lib/auth/use-auth'

export function EditTeamDialog({ team }: { team: Team }) {
  const { user } = useAuth()
  const { mutateAsync } = useUpdateTeam(team.id)
  const is_admin = user?.role === 'admin'

  async function onSubmit(values: TeamValues) {
    await mutateAsync(toUpdateData(values, team, is_admin))
  }

  return (
    <TeamDialog
      defaults={teamToValues(team)}
      description="Update the team details and schedule."
      id_prefix={`edit-team-${team.id}`}
      on_submit={onSubmit}
      show_manager={is_admin}
      submit_label="Save changes"
      title="Edit team"
      trigger={
        <Button variant="outline">
          <PencilIcon />
          Edit
        </Button>
      }
    />
  )
}
