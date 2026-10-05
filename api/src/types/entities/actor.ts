import type { Role } from './user.js';

export type Actor = {
  id: string;
  role: Role;
  team_ids: string[];
};
