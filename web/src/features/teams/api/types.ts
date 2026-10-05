export interface BulkResult {
  failed: number
  ok: number
}

export interface CreateTeamBody {
  description?: string
  manager_id?: string
  name: string
  weekly_hours_target?: number
  work_end?: string
  work_start?: string
}

export interface ListTeamsBody {
  archived?: boolean
  cursor?: string
  limit?: number
  manager_id?: string
  member_id?: string
  order?: 'asc' | 'desc'
}

export interface Page<T> {
  items: T[]
  more: boolean
  next: null | string
  total: number
}

export interface Team {
  archived_at: null | number
  created_at: number
  description: null | string
  id: string
  manager_id: string
  member_count: number
  name: string
  object: 'team'
  updated_at: number
  weekly_hours_target: number
  work_end: string
  work_start: string
}

export interface TeamMember {
  email: string
  first_name: string
  id: string
  last_name: string
  role: TeamRole
}

export type TeamRole = 'admin' | 'employee' | 'manager'

export interface UpdateTeamData {
  description?: null | string
  manager_id?: string
  name?: string
  weekly_hours_target?: number
  work_end?: string
  work_start?: string
}
