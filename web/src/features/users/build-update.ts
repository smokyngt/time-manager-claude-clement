import type { EditableField } from '@/features/users/permissions'
import type { EditUserValues } from '@/features/users/schemas'
import type { UserRecord, UserUpdateData } from '@/features/users/types'

export function buildUpdate(
  values: EditUserValues,
  user: UserRecord,
  fields: EditableField[],
): UserUpdateData {
  const update: UserUpdateData = {}
  if (fields.includes('first_name') && values.first_name && values.first_name !== user.first_name) {
    update.first_name = values.first_name
  }
  if (fields.includes('last_name') && values.last_name && values.last_name !== user.last_name) {
    update.last_name = values.last_name
  }
  if (fields.includes('email') && values.email && values.email !== user.email) {
    update.email = values.email
  }
  if (fields.includes('role') && values.role && values.role !== user.role) {
    update.role = values.role
  }
  if (fields.includes('phone_number') && values.phone_number !== undefined) {
    const phone = values.phone_number.trim()
    if (phone !== (user.phone_number ?? '')) update.phone_number = phone === '' ? null : phone
  }
  if (fields.includes('password') && values.password) update.password = values.password
  return update
}
