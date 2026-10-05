import { archive } from './archive.js';
import { create } from './create.js';
import { remove } from './delete.js';
import { list } from './list.js';
import { restore } from './restore.js';
import { retrieve } from './retrieve.js';
import { update } from './update.js';

import type { UserCreateData, UserUpdateData } from '@/services/user/index.js';
import type { Role, User } from '@/types/entities/user.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

export interface ArchiveParams {
  id: string;
}

export interface BulkFailure {
  code: string;
  id: string;
}

export interface CreateBody extends UserCreateData {
  role?: Role;
}

export interface DeleteBody {
  ids: string[];
}

export interface DeleteResponse {
  deleted: string[];
  failed: BulkFailure[];
  success: boolean;
}

export interface ListBody {
  archived?: boolean;
  created_after?: number | string;
  created_before?: number | string;
  cursor?: string;
  ids?: string[];
  limit?: number;
  order?: 'asc' | 'desc';
  role?: Role;
  team_id?: string;
}

export interface ListResponse {
  items: User[];
  more: boolean;
  next: null | string;
  total: number;
}

export interface RestoreParams {
  id: string;
}

export interface RetrieveParams {
  id: string;
}

export interface UpdateBody {
  data: UserUpdateData;
  ids: string[];
}

export interface UpdateResponse {
  failed: BulkFailure[];
  success: boolean;
  updated: string[];
}

export interface UserControllerType {
  archive: (
    req: FastifyRequest<{ Params: ArchiveParams }>,
    reply: FastifyReply<{ Reply: ReplyEnvelope<User> }>,
  ) => Promise<void>;
  create: (
    req: FastifyRequest<{ Body: CreateBody }>,
    reply: FastifyReply<{ Reply: ReplyEnvelope<User> }>,
  ) => Promise<void>;
  delete: (
    req: FastifyRequest<{ Body: DeleteBody }>,
    reply: FastifyReply<{ Reply: ReplyEnvelope<DeleteResponse> }>,
  ) => Promise<void>;
  list: (
    req: FastifyRequest<{ Body: ListBody }>,
    reply: FastifyReply<{ Reply: ReplyEnvelope<ListResponse> }>,
  ) => Promise<void>;
  restore: (
    req: FastifyRequest<{ Params: RestoreParams }>,
    reply: FastifyReply<{ Reply: ReplyEnvelope<User> }>,
  ) => Promise<void>;
  retrieve: (
    req: FastifyRequest<{ Params: RetrieveParams }>,
    reply: FastifyReply<{ Reply: ReplyEnvelope<User> }>,
  ) => Promise<void>;
  update: (
    req: FastifyRequest<{ Body: UpdateBody }>,
    reply: FastifyReply<{ Reply: ReplyEnvelope<UpdateResponse> }>,
  ) => Promise<void>;
}

class UserController implements UserControllerType {
  public archive = archive;
  public create = create;
  public delete = remove;
  public list = list;
  public restore = restore;
  public retrieve = retrieve;
  public update = update;
}

export const user = new UserController();
