import type { Role } from '@/features/users/types'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { roleLabel } from '@/features/users/role-label'

export function RoleSelect({
  id,
  onChange,
  roles,
  value,
}: {
  id: string
  onChange: (role: Role) => void
  roles: Role[]
  value: Role
}) {
  return (
    <Select
      onValueChange={(next) => {
        onChange(next as Role)
      }}
      value={value}
    >
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roles.map((role) => (
          <SelectItem key={role} value={role}>
            {roleLabel(role)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
