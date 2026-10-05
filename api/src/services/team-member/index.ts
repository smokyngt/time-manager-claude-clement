import { add } from './add.js';
import { list } from './list.js';
import { remove } from './remove.js';
import { team } from './team.js';

import type { TeamRow } from '@/db/schema/team.js';
import type { Actor } from '@/types/entities/actor.js';
import type { Role, User } from '@/types/entities/user.js';

export type AddParams = {
  actor: Actor;
  roles: Role[];
  team: TeamRow;
  user_ids: string[];
};

export type AddResponse = {
  added: string[];
  failed: BulkFailure[];
  success: boolean;
};

export type BulkFailure = {
  code: string;
  id: string;
};

export type ListParams = {
  cursor?: string;
  id: string;
  limit: number;
  order: 'asc' | 'desc';
};

export type ListResponse = {
  items: User[];
  more: boolean;
  next: null | string;
  total: number;
};

export type RemoveParams = {
  actor: Actor;
  id: string;
  user_ids: string[];
};

export type RemoveResponse = {
  failed: BulkFailure[];
  removed: string[];
  success: boolean;
};

export type TeamParams = {
  id: string;
};

export type TeamResponse = {
  team: TeamRow;
};

class TeamMemberService {
  public add = add;
  public list = list;
  public remove = remove;
  public team = team;
}

export const teamMemberService = new TeamMemberService();
