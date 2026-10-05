export type Role = 'admin' | 'employee' | 'manager'

export interface UserRecord {
  archived_at: null | number
  created_at: number
  email: string
  first_name: string
  id: string
  last_name: string
  object: 'user'
  phone_number: null | string
  role: Role
  updated_at: null | number
}

export interface BulkFailure {
  code: string
  id: string
}

export interface BulkResult {
  failed: BulkFailure[]
  succeeded: string[]
}

export interface UserFilters {
  archived: boolean
  role: 'all' | Role
}

export interface UserPage {
  items: UserRecord[]
  more: boolean
  next: null | string
  total: number
}

export interface UserCreateInput {
  email: string
  first_name: string
  last_name: string
  password?: string
  phone_number?: string
  role?: Role
}

export interface UserUpdateData {
  email?: string
  first_name?: string
  last_name?: string
  password?: string
  phone_number?: null | string
  role?: Role
}
