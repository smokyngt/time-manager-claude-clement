import { add } from './add.js';
import { list } from './list.js';
import { remove } from './remove.js';

import type { User } from '@/types/entities/user.js';

export type AddBody = {
  user_ids: string[];
};

export type AddParams = {
  id: string;
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

export type ListBody = {
  cursor?: string;
  limit?: number;
  order?: 'asc' | 'desc';
};

export type ListParams = {
  id: string;
};

export type ListResponse = {
  items: User[];
  more: boolean;
  next: null | string;
  total: number;
};

export type RemoveBody = {
  user_ids: string[];
};

export type RemoveParams = {
  id: string;
};

export type RemoveResponse = {
  failed: BulkFailure[];
  removed: string[];
  success: boolean;
};

class TeamMemberController {
  public add = add;
  public list = list;
  public remove = remove;
}

export const teamMember = new TeamMemberController();
