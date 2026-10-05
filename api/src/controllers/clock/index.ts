import { create } from './create.js';
import { current } from './current.js';
import { remove } from './delete.js';
import { clockIn } from './in.js';
import { list } from './list.js';
import { clockOut } from './out.js';
import { retrieve } from './retrieve.js';
import { update } from './update.js';

import type { ClockCreateData, ClockUpdateData } from '@/services/clock/index.js';
import type { Clock } from '@/types/entities/clock.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

export interface BulkFailure {
  code: string;
  id: string;
}

export type CreateBody = ClockCreateData;

export interface ClockControllerType {
  create: (
    req: FastifyRequest<{ Body: CreateBody }>,
    reply: FastifyReply<{ Reply: ReplyEnvelope<Clock> }>,
  ) => Promise<void>;
  current: (
    req: FastifyRequest,
    reply: FastifyReply<{ Reply: ReplyEnvelope<CurrentResponse> }>,
  ) => Promise<void>;
  delete: (
    req: FastifyRequest<{ Body: DeleteBody }>,
    reply: FastifyReply<{ Reply: ReplyEnvelope<DeleteResponse> }>,
  ) => Promise<void>;
  in: (
    req: FastifyRequest<{ Body: InBody }>,
    reply: FastifyReply<{ Reply: ReplyEnvelope<Clock> }>,
  ) => Promise<void>;
  list: (
    req: FastifyRequest<{ Body: ListBody }>,
    reply: FastifyReply<{ Reply: ReplyEnvelope<ListResponse> }>,
  ) => Promise<void>;
  out: (
    req: FastifyRequest<{ Body: OutBody }>,
    reply: FastifyReply<{ Reply: ReplyEnvelope<Clock> }>,
  ) => Promise<void>;
  retrieve: (
    req: FastifyRequest<{ Params: RetrieveParams }>,
    reply: FastifyReply<{ Reply: ReplyEnvelope<Clock> }>,
  ) => Promise<void>;
  update: (
    req: FastifyRequest<{ Body: UpdateBody }>,
    reply: FastifyReply<{ Reply: ReplyEnvelope<UpdateResponse> }>,
  ) => Promise<void>;
}

export interface CurrentResponse {
  clock: Clock | null;
}

export interface DeleteBody {
  ids: string[];
}

export interface DeleteResponse {
  deleted: string[];
  failed: BulkFailure[];
  success: boolean;
}

export interface InBody {
  note?: string;
}

export interface ListBody {
  cursor?: string;
  from?: number | string;
  limit?: number;
  open?: boolean;
  order?: 'asc' | 'desc';
  to?: number | string;
  user_ids?: string[];
}

export interface ListResponse {
  items: Clock[];
  more: boolean;
  next: null | string;
  total: number;
}

export interface OutBody {
  note?: string;
}

export interface RetrieveParams {
  id: string;
}

export interface UpdateBody {
  data: ClockUpdateData;
  ids: string[];
}

export interface UpdateResponse {
  failed: BulkFailure[];
  success: boolean;
  updated: string[];
}

class ClockController implements ClockControllerType {
  public create = create;
  public current = current;
  public delete = remove;
  public in = clockIn;
  public list = list;
  public out = clockOut;
  public retrieve = retrieve;
  public update = update;
}

export const clock = new ClockController();
