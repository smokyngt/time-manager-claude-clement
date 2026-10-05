import { archive } from './archive.js';
import { create } from './create.js';
import { remove } from './delete.js';
import { list } from './list.js';
import { restore } from './restore.js';
import { retrieve } from './retrieve.js';
import { update } from './update.js';

import type { TeamCreateData, TeamUpdateData } from '@/services/team/index.js';
import type { Team } from '@/types/entities/team.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

export interface ArchiveParams {
  id: string;
}

export interface BulkFailure {
  code: string;
  id: string;
}

export interface CreateBody extends Omit<TeamCreateData, 'manager_id'> {
  manager_id?: string;
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
  manager_id?: string;
  member_id?: string;
  order?: 'asc' | 'desc';
}

export interface ListResponse {
  items: Team[];
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

export interface TeamControllerType {
  archive: (
    req: FastifyRequest<{ Params: ArchiveParams }>,
    reply: FastifyReply<{ Reply: ReplyEnvelope<Team> }>,
  ) => Promise<void>;
  create: (
    req: FastifyRequest<{ Body: CreateBody }>,
    reply: FastifyReply<{ Reply: ReplyEnvelope<Team> }>,
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
    reply: FastifyReply<{ Reply: ReplyEnvelope<Team> }>,
  ) => Promise<void>;
  retrieve: (
    req: FastifyRequest<{ Params: RetrieveParams }>,
    reply: FastifyReply<{ Reply: ReplyEnvelope<Team> }>,
  ) => Promise<void>;
  update: (
    req: FastifyRequest<{ Body: UpdateBody }>,
    reply: FastifyReply<{ Reply: ReplyEnvelope<UpdateResponse> }>,
  ) => Promise<void>;
}

export interface UpdateBody {
  data: TeamUpdateData;
  ids: string[];
}

export interface UpdateResponse {
  failed: BulkFailure[];
  success: boolean;
  updated: string[];
}

class TeamController implements TeamControllerType {
  public archive = archive;
  public create = create;
  public delete = remove;
  public list = list;
  public restore = restore;
  public retrieve = retrieve;
  public update = update;
}

export const team = new TeamController();
