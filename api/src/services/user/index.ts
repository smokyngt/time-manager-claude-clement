import { archive } from './archive.js';
import { create } from './create.js';
import { remove } from './delete.js';
import { list } from './list.js';
import { restore } from './restore.js';
import { retrieve } from './retrieve.js';
import { update } from './update.js';

import type { Actor } from '@/types/entities/index.js';
import type { Role, User } from '@/types/entities/index.js';

export type ArchiveUserParams = {
  actor: Actor;
  id: string;
};

export type ArchiveUserResponse = {
  user: User;
};

export type CreateUserParams = {
  actor: Actor;
  data: UserCreateData;
};

export type CreateUserResponse = {
  user: User;
};

export type DeleteUserParams = {
  actor: Actor;
  id: string;
};

export type DeleteUserResponse = {
  success: boolean;
};

export type ListUsersParams = {
  cursor?: string;
  filters: UserFilters;
  limit: number;
  order: 'asc' | 'desc';
};

export type ListUsersResponse = {
  items: User[];
  more: boolean;
  next: null | string;
  total: number;
};

export type RestoreUserParams = {
  actor: Actor;
  id: string;
};

export type RestoreUserResponse = {
  user: User;
};

export type RetrieveUserParams = {
  id: string;
};

export type RetrieveUserResponse = {
  user: User;
};

export type UpdateUserParams = {
  actor: Actor;
  data: UserUpdateData;
  id: string;
};

export type UpdateUserResponse = {
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

export class UserService {
  public archive = archive;
  public create = create;
  public delete = remove;
  public list = list;
  public restore = restore;
  public retrieve = retrieve;
  public update = update;
}

export const userService = new UserService();
