import { userName } from '@/features/teams/api/users'
import { useUserOptions } from '@/features/teams/hooks/use-team-members'
import { useAuth } from '@/lib/auth/use-auth'

export function ManagerName({ manager_id }: { manager_id: string }) {
  const { user } = useAuth()
  const { data } = useUserOptions(['admin', 'manager'])
  if (user?.id === manager_id) return <>You</>
  const manager = data?.find((candidate) => candidate.id === manager_id)
  return <>{manager ? userName(manager) : '-'}</>
}
