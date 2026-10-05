export const ROLES = ['admin', 'employee', 'manager'] as const;

export type Role = (typeof ROLES)[number];

export interface User {
  archived_at: null | number;
  created_at: number;
  email: string;
  first_name: string;
  id: string;
  last_name: string;
  object: 'user';
  phone_number: null | string;
  role: Role;
  updated_at: null | number;
}
