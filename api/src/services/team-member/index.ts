import { add } from './add.js';
import { list } from './list.js';
import { remove } from './remove.js';

import type { Actor } from '@/types/entities/actor.js';
import type { User } from '@/types/entities/user.js';

export interface AddParams {
  actor: Actor;
  id: string;
  user_ids: string[];
}

export interface AddResponse {
  added: string[];
  failed: BulkFailure[];
  success: boolean;
}

export interface BulkFailure {
  code: string;
  id: string;
}

export interface ListParams {
  actor: Actor;
  cursor?: string;
  id: string;
  limit: number;
  order: 'asc' | 'desc';
}

export interface ListResponse {
  items: User[];
  more: boolean;
  next: null | string;
  total: number;
}

export interface RemoveParams {
  actor: Actor;
  id: string;
  user_ids: string[];
}

export interface RemoveResponse {
  failed: BulkFailure[];
  removed: string[];
  success: boolean;
}

export interface TeamMemberServiceType {
  add: (params: AddParams) => Promise<AddResponse>;
  list: (params: ListParams) => Promise<ListResponse>;
  remove: (params: RemoveParams) => Promise<RemoveResponse>;
}

class TeamMemberService implements TeamMemberServiceType {
  public add = add;
  public list = list;
  public remove = remove;
}

export const teamMemberService = new TeamMemberService();
