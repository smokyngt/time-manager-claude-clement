import { add } from './add.js';
import { list } from './list.js';
import { remove } from './remove.js';

import type { BulkFailure } from '@/types/entities/index.js';
import type { User } from '@/types/entities/index.js';

export type AddTeamMembersBody = {
  user_ids: string[];
};

export type AddTeamMembersParams = {
  id: string;
};

export type AddTeamMembersResponse = {
  added: string[];
  failed: BulkFailure[];
  success: boolean;
};

export type ListTeamMembersBody = {
  cursor?: string;
  limit?: number;
  order?: 'asc' | 'desc';
};

export type ListTeamMembersParams = {
  id: string;
};

export type ListTeamMembersResponse = {
  items: User[];
  more: boolean;
  next: null | string;
  total: number;
};

export type RemoveTeamMembersBody = {
  user_ids: string[];
};

export type RemoveTeamMembersParams = {
  id: string;
};

export type RemoveTeamMembersResponse = {
  failed: BulkFailure[];
  removed: string[];
  success: boolean;
};

export class TeamMemberController {
  public add = add;
  public list = list;
  public remove = remove;
}

export const teamMemberController = new TeamMemberController();
