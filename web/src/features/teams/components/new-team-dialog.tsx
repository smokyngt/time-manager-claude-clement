import { PlusIcon } from 'lucide-react'

import type { TeamValues } from '@/features/teams/team-schema'

import { Button } from '@/components/ui/button'
import { TeamDialog } from '@/features/teams/components/team-dialog'
import { useCreateTeam } from '@/features/teams/hooks/use-teams'
import { TEAM_DEFAULTS, toCreateBody } from '@/features/teams/team-schema'
import { useAuth } from '@/lib/auth/use-auth'

export function NewTeamDialog() {
  const { user } = useAuth()
  const { mutateAsync } = useCreateTeam()

  if (!user || user.role === 'employee') return null

  async function onSubmit(values: TeamValues) {
    await mutateAsync(toCreateBody(values))
  }

  return (
    <TeamDialog
      defaults={{ ...TEAM_DEFAULTS, manager_id: user.id }}
      description="Set the schedule and weekly target. You can add members afterwards."
      id_prefix="new-team"
      on_submit={onSubmit}
      show_manager={user.role === 'admin'}
      submit_label="Create team"
      title="New team"
      trigger={
        <Button>
          <PlusIcon />
          New team
        </Button>
      }
    />
  )
}
