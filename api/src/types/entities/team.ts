export interface Team {
  archived_at: null | number;
  created_at: number;
  description: null | string;
  id: string;
  manager_id: string;
  member_count: number;
  name: string;
  object: 'team';
  updated_at: null | number;
  weekly_hours_target: number;
  work_end: string;
  work_start: string;
}
