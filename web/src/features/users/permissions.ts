import type { Role, UserRecord } from '@/features/users/types'

export type EditableField = 'email' | 'first_name' | 'last_name' | 'password' | 'phone_number' | 'role'

interface Actor {
  id: string
  role: Role
}

const MANAGER_FIELDS: EditableField[] = ['email', 'first_name', 'last_name', 'password', 'phone_number']
const SELF_FIELDS: EditableField[] = ['first_name', 'last_name', 'password', 'phone_number']

export function assignableRoles(actor_role: Role): Role[] {
  return actor_role === 'admin' ? ['employee', 'manager', 'admin'] : ['employee']
}

export function canArchive(actor: Actor, target: Pick<UserRecord, 'id' | 'role'>) {
  if (actor.id === target.id) return false
  if (actor.role === 'admin') return true
  return actor.role === 'manager' && target.role === 'employee'
}

export function canDelete(actor: Actor, target: Pick<UserRecord, 'id'>) {
  return actor.role === 'admin' && actor.id !== target.id
}

export function canEdit(actor: Actor, target: Pick<UserRecord, 'id' | 'role'>) {
  return editableFields(actor, target).length > 0
}

export function editableFields(actor: Actor, target: Pick<UserRecord, 'id' | 'role'>): EditableField[] {
  if (actor.id === target.id) return SELF_FIELDS
  if (actor.role === 'admin') return [...MANAGER_FIELDS, 'role']
  if (actor.role === 'manager' && target.role === 'employee') return MANAGER_FIELDS
  return []
}
