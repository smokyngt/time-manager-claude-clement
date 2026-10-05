import type { Role } from '@/features/users/types'

const LABELS: Record<Role, string> = {
  admin: 'Admin',
  employee: 'Employee',
  manager: 'Manager',
}

export function roleLabel(role: Role) {
  return LABELS[role]
}
