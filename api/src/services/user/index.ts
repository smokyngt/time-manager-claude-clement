import { archive } from './archive.js';
import { create } from './create.js';
import { remove } from './delete.js';
import { list } from './list.js';
import { restore } from './restore.js';
import { retrieve } from './retrieve.js';
import { update } from './update.js';

import type { Actor } from '@/types/entities/actor.js';
import type { Role, User } from '@/types/entities/user.js';

export type ArchiveParams = {
  actor: Actor;
  id: string;
};

export type ArchiveResponse = {
  user: User;
};

export type CreateParams = {
  actor: Actor;
  data: UserCreateData;
};

export type CreateResponse = {
  user: User;
};

export type DeleteParams = {
  actor: Actor;
  id: string;
};

export type DeleteResponse = {
  success: boolean;
};

export type ListParams = {
  cursor?: string;
  filters: UserFilters;
  limit: number;
  order: 'asc' | 'desc';
};

export type ListResponse = {
  items: User[];
  more: boolean;
  next: null | string;
  total: number;
};

export type RestoreParams = {
  actor: Actor;
  id: string;
};

export type RestoreResponse = {
  user: User;
};

export type RetrieveParams = {
  id: string;
};

export type RetrieveResponse = {
  user: User;
};

export type UpdateParams = {
  actor: Actor;
  data: UserUpdateData;
  id: string;
};

export type UpdateResponse = {
  user: User;
};

export type UserCreateData = {
  email: string;
  first_name: string;
  last_name: string;
  password?: string;
  phone_number?: null | string;
  role?: Role;
};

export type UserFilters = {
  archived?: boolean;
  created_after?: number;
  created_before?: number;
  ids?: string[];
  managed_by?: string;
  role?: Role;
  team_id?: string;
};

export type UserUpdateData = {
  current_password?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  password?: string;
  phone_number?: null | string;
  role?: Role;
};

class UserService {
  public archive = archive;
  public create = create;
  public delete = remove;
  public list = list;
  public restore = restore;
  public retrieve = retrieve;
  public update = update;
}

export const userService = new UserService();
