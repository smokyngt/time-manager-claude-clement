import { archive } from './archive.js';
import { create } from './create.js';
import { remove } from './delete.js';
import { list } from './list.js';
import { restore } from './restore.js';
import { retrieve } from './retrieve.js';
import { update } from './update.js';

import type { UserCreateData, UserUpdateData } from '@/services/user/index.js';
import type { Role, User } from '@/types/entities/user.js';

export type ArchiveParams = {
  id: string;
};

export type BulkFailure = {
  code: string;
  id: string;
};

export type CreateBody = UserCreateData;

export type DeleteBody = {
  ids: string[];
};

export type DeleteResponse = {
  deleted: string[];
  failed: BulkFailure[];
  success: boolean;
};

export type ListBody = {
  archived?: boolean;
  created_after?: number | string;
  created_before?: number | string;
  cursor?: string;
  ids?: string[];
  limit?: number;
  order?: 'asc' | 'desc';
  role?: Role;
  team_id?: string;
};

export type ListResponse = {
  items: User[];
  more: boolean;
  next: null | string;
  total: number;
};

export type RestoreParams = {
  id: string;
};

export type RetrieveParams = {
  id: string;
};

export type UpdateBody = {
  data: UserUpdateData;
  ids: string[];
};

export type UpdateResponse = {
  failed: BulkFailure[];
  success: boolean;
  updated: string[];
};

export type UserResponse = {
  user: User;
};

class UserController {
  public archive = archive;
  public create = create;
  public delete = remove;
  public list = list;
  public restore = restore;
  public retrieve = retrieve;
  public update = update;
}

export const user = new UserController();
