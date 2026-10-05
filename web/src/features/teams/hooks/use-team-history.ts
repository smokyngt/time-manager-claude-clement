import type { Team, TeamUpdateData } from '@time-manager/sdk'

import { useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { UndoEntry } from '@/stores/undo'

import { QueryKeys } from '@/config/query-keys'
import { sdk } from '@/config/sdk'

export function useTeamHistory() {
  const { t } = useTranslation('teams')
  const queryClient = useQueryClient()

  return useMemo(() => {
    const refresh = () => queryClient.invalidateQueries({ queryKey: QueryKeys.teamsAll() })

    return {
      created: (team: Team): UndoEntry => ({
        label: t('history.created', { name: team.name }),
        redo: async () => {
          await sdk.teams.restore(team.id)
          await refresh()
        },
        undo: async () => {
          await sdk.teams.archive(team.id)
          await refresh()
        },
      }),
      updated: (team: Team, before: TeamUpdateData, after: TeamUpdateData): UndoEntry => ({
        label: t('history.updated', { name: team.name }),
        redo: async () => {
          await sdk.teams.update([team.id], after)
          await refresh()
        },
        undo: async () => {
          await sdk.teams.update([team.id], before)
          await refresh()
        },
      }),
    }
  }, [queryClient, t])
}
