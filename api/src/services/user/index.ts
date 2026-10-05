import { archive } from './archive.js';
import { create } from './create.js';
import { remove } from './delete.js';
import { list } from './list.js';
import { restore } from './restore.js';
import { retrieve } from './retrieve.js';
import { update } from './update.js';

import type { Actor } from '@/types/entities/actor.js';
import type { Role, User } from '@/types/entities/user.js';

export interface ArchiveParams {
  actor: Actor;
  id: string;
}

export interface ArchiveResponse {
  user: User;
}

export interface CreateParams {
  actor: Actor;
  data: UserCreateData;
}

export interface CreateResponse {
  user: User;
}

export interface DeleteParams {
  actor: Actor;
  id: string;
}

export interface DeleteResponse {
  success: boolean;
}

export interface ListParams {
  cursor?: string;
  filters: UserFilters;
  limit: number;
  order: 'asc' | 'desc';
}

export interface ListResponse {
  items: User[];
  more: boolean;
  next: null | string;
  total: number;
}

export interface RestoreParams {
  actor: Actor;
  id: string;
}

export interface RestoreResponse {
  user: User;
}

export interface RetrieveParams {
  id: string;
}

export interface RetrieveResponse {
  user: User;
}

export interface UpdateParams {
  actor: Actor;
  data: UserUpdateData;
  id: string;
}

export interface UpdateResponse {
  user: User;
}

export interface UserCreateData {
  email: string;
  first_name: string;
  last_name: string;
  password?: string;
  phone_number?: null | string;
  role?: Role;
}

export interface UserFilters {
  archived?: boolean;
  created_after?: number;
  created_before?: number;
  ids?: string[];
  role?: Role;
}

export interface UserServiceType {
  archive: (params: ArchiveParams) => Promise<ArchiveResponse>;
  create: (params: CreateParams) => Promise<CreateResponse>;
  delete: (params: DeleteParams) => Promise<DeleteResponse>;
  list: (params: ListParams) => Promise<ListResponse>;
  restore: (params: RestoreParams) => Promise<RestoreResponse>;
  retrieve: (params: RetrieveParams) => Promise<RetrieveResponse>;
  update: (params: UpdateParams) => Promise<UpdateResponse>;
}

export interface UserUpdateData {
  email?: string;
  first_name?: string;
  last_name?: string;
  password?: string;
  phone_number?: null | string;
  role?: Role;
}

class UserService implements UserServiceType {
  public archive = archive;
  public create = create;
  public delete = remove;
  public list = list;
  public restore = restore;
  public retrieve = retrieve;
  public update = update;
}

export const userService = new UserService();
