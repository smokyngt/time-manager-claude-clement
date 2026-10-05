import { archive } from './archive.js';
import { create } from './create.js';
import { remove } from './delete.js';
import { list } from './list.js';
import { restore } from './restore.js';
import { retrieve } from './retrieve.js';
import { update } from './update.js';

import type { BulkFailure } from '@/types/entities/index.js';
import type { UserCreateData, UserUpdateData } from '@/services/index.js';
import type { Role, User } from '@/types/entities/index.js';

export type ArchiveUserParams = {
  id: string;
};

export type CreateUserBody = UserCreateData;

export type DeleteUsersBody = {
  ids: string[];
};

export type DeleteUsersResponse = {
  deleted: string[];
  failed: BulkFailure[];
  success: boolean;
};

export type ListUsersBody = {
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

export type ListUsersResponse = {
  items: User[];
  more: boolean;
  next: null | string;
  total: number;
};

export type RestoreUserParams = {
  id: string;
};

export type RetrieveUserParams = {
  id: string;
};

export type UpdateUsersBody = {
  data: UserUpdateData;
  ids: string[];
};

export type UpdateUsersResponse = {
  failed: BulkFailure[];
  success: boolean;
  updated: string[];
};

export type UserResponse = {
  user: User;
};

export class UserController {
  public archive = archive;
  public create = create;
  public delete = remove;
  public list = list;
  public restore = restore;
  public retrieve = retrieve;
  public update = update;
}

export const userController = new UserController();
