import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Role } from '@/features/users/types'

const LABELS: Record<Role, string> = {
  admin: 'Admin',
  employee: 'Employee',
  manager: 'Manager',
}

export function roleLabel(role: Role) {
  return LABELS[role]
}

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
            {LABELS[role]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
