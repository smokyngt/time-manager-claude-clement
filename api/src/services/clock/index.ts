import { create } from './create.js';
import { current } from './current.js';
import { remove } from './delete.js';
import { clockIn } from './in.js';
import { list } from './list.js';
import { clockOut } from './out.js';
import { retrieve } from './retrieve.js';
import { update } from './update.js';

import type { Actor } from '@/types/entities/actor.js';
import type { Clock } from '@/types/entities/clock.js';

export interface ClockCreateData {
  clocked_in_at: number;
  clocked_out_at: number;
  note?: string;
  user_id: string;
}

export interface ClockFilters {
  from?: number;
  open?: boolean;
  to?: number;
  user_ids?: string[];
}

export interface ClockServiceType {
  create: (params: CreateParams) => Promise<CreateResponse>;
  current: (params: CurrentParams) => Promise<CurrentResponse>;
  delete: (params: DeleteParams) => Promise<DeleteResponse>;
  in: (params: InParams) => Promise<InResponse>;
  list: (params: ListParams) => Promise<ListResponse>;
  out: (params: OutParams) => Promise<OutResponse>;
  retrieve: (params: RetrieveParams) => Promise<RetrieveResponse>;
  update: (params: UpdateParams) => Promise<UpdateResponse>;
}

export interface ClockUpdateData {
  clocked_in_at?: number;
  clocked_out_at?: number;
  note?: null | string;
}

export interface CreateParams {
  actor: Actor;
  data: ClockCreateData;
}

export interface CreateResponse {
  clock: Clock;
}

export interface CurrentParams {
  actor: Actor;
}

export interface CurrentResponse {
  clock: Clock | null;
}

export interface DeleteParams {
  actor: Actor;
  id: string;
}

export interface DeleteResponse {
  success: boolean;
}

export interface InParams {
  actor: Actor;
  note?: string;
}

export interface InResponse {
  clock: Clock;
}

export interface ListParams {
  cursor?: string;
  filters: ClockFilters;
  limit: number;
  order: 'asc' | 'desc';
}

export interface ListResponse {
  items: Clock[];
  more: boolean;
  next: null | string;
  total: number;
}

export interface OutParams {
  actor: Actor;
  note?: string;
}

export interface OutResponse {
  clock: Clock;
}

export interface RetrieveParams {
  id: string;
}

export interface RetrieveResponse {
  clock: Clock;
}

export interface UpdateParams {
  actor: Actor;
  data: ClockUpdateData;
  id: string;
}

export interface UpdateResponse {
  clock: Clock;
}

class ClockService implements ClockServiceType {
  public create = create;
  public current = current;
  public delete = remove;
  public in = clockIn;
  public list = list;
  public out = clockOut;
  public retrieve = retrieve;
  public update = update;
}

export const clockService = new ClockService();
