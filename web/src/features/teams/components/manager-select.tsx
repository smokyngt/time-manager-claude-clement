import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { userName } from '@/features/teams/api/users'
import { useUserOptions } from '@/features/teams/hooks/use-team-members'

export function ManagerSelect({
  id,
  invalid,
  onChange,
  value,
}: {
  id: string
  invalid?: boolean
  onChange: (value: string) => void
  value: string
}) {
  const { data = [], isPending } = useUserOptions(['admin', 'manager'])

  return (
    <Select disabled={isPending} onValueChange={onChange} value={value}>
      <SelectTrigger aria-invalid={invalid} id={id}>
        <SelectValue placeholder={isPending ? 'Loading managers' : 'Select a manager'} />
      </SelectTrigger>
      <SelectContent>
        {data.map((user) => (
          <SelectItem key={user.id} value={user.id}>
            {userName(user)} ({user.role})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
