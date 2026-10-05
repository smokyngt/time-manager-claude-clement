import { add } from './add.js';
import { list } from './list.js';
import { remove } from './remove.js';
import { team } from './team.js';

import type { BulkFailure } from '@/types/entities/index.js';
import type { TeamRow } from '@/db/schema/index.js';
import type { Actor } from '@/types/entities/index.js';
import type { Role, User } from '@/types/entities/index.js';

export type AddTeamMembersParams = {
  actor: Actor;
  roles: Role[];
  team: TeamRow;
  user_ids: string[];
};

export type AddTeamMembersResponse = {
  added: string[];
  failed: BulkFailure[];
  success: boolean;
};

export type ListTeamMembersParams = {
  cursor?: string;
  id: string;
  limit: number;
  order: 'asc' | 'desc';
};

export type ListTeamMembersResponse = {
  items: User[];
  more: boolean;
  next: null | string;
  total: number;
};

export type RemoveTeamMembersParams = {
  actor: Actor;
  id: string;
  user_ids: string[];
};

export type RemoveTeamMembersResponse = {
  failed: BulkFailure[];
  removed: string[];
  success: boolean;
};

export type TeamMemberTeamParams = {
  id: string;
};

export type TeamMemberTeamResponse = {
  team: TeamRow;
};

export class TeamMemberService {
  public add = add;
  public list = list;
  public remove = remove;
  public team = team;
}

export const teamMemberService = new TeamMemberService();
