import type { Role } from './user.js';

export interface Actor {
  id: string;
  role: Role;
  team_ids: string[];
}
