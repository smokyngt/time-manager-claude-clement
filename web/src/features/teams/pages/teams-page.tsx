import { useState } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { NewTeamDialog } from '@/features/teams/components/new-team-dialog'
import { TeamsGrid } from '@/features/teams/components/teams-grid'
import { canCreateTeam } from '@/features/teams/permissions'
import { useAuth } from '@/lib/auth/use-auth'

export function TeamsPage() {
  const { user } = useAuth()
  const [status, setStatus] = useState('active')

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Select onValueChange={setStatus} value={status}>
              <SelectTrigger aria-label="Filter teams" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            {canCreateTeam(user) ? <NewTeamDialog /> : null}
          </>
        }
        description="Organize employees into teams"
        title="Teams"
      />
      <TeamsGrid archived={status === 'archived'} />
    </div>
  )
}
