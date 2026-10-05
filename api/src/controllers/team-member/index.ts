import { add } from './add.js';
import { list } from './list.js';
import { remove } from './remove.js';

import type { User } from '@/types/entities/user.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

export interface AddBody {
  user_ids: string[];
}

export interface AddParams {
  id: string;
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

export interface ListBody {
  cursor?: string;
  limit?: number;
  order?: 'asc' | 'desc';
}

export interface ListParams {
  id: string;
}

export interface ListResponse {
  items: User[];
  more: boolean;
  next: null | string;
  total: number;
}

export interface RemoveBody {
  user_ids: string[];
}

export interface RemoveParams {
  id: string;
}

export interface RemoveResponse {
  failed: BulkFailure[];
  removed: string[];
  success: boolean;
}

export interface TeamMemberControllerType {
  add: (
    req: FastifyRequest<{ Body: AddBody; Params: AddParams }>,
    reply: FastifyReply<{ Reply: ReplyEnvelope<AddResponse> }>,
  ) => Promise<void>;
  list: (
    req: FastifyRequest<{ Body: ListBody; Params: ListParams }>,
    reply: FastifyReply<{ Reply: ReplyEnvelope<ListResponse> }>,
  ) => Promise<void>;
  remove: (
    req: FastifyRequest<{ Body: RemoveBody; Params: RemoveParams }>,
    reply: FastifyReply<{ Reply: ReplyEnvelope<RemoveResponse> }>,
  ) => Promise<void>;
}

class TeamMemberController implements TeamMemberControllerType {
  public add = add;
  public list = list;
  public remove = remove;
}

export const teamMember = new TeamMemberController();
