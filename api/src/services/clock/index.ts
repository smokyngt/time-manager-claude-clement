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

export type ClockCreateData = {
  clocked_in_at: number;
  clocked_out_at: number;
  note?: string;
  user_id: string;
};

export type ClockFilters = {
  from?: number;
  open?: boolean;
  to?: number;
  user_ids?: string[];
};

export type ClockInParams = {
  actor: Actor;
  note?: string;
};

export type ClockInResponse = {
  clock: Clock;
};

export type ClockOutParams = {
  actor: Actor;
  note?: string;
};

export type ClockOutResponse = {
  clock: Clock;
};

export type ClockUpdateData = {
  clocked_in_at?: number;
  clocked_out_at?: number;
  note?: null | string;
};

export type CreateParams = {
  actor: Actor;
  data: ClockCreateData;
};

export type CreateResponse = {
  clock: Clock;
};

export type CurrentParams = {
  actor: Actor;
};

export type CurrentResponse = {
  clock: Clock | null;
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
  filters: ClockFilters;
  limit: number;
  order: 'asc' | 'desc';
};

export type ListResponse = {
  items: Clock[];
  more: boolean;
  next: null | string;
  total: number;
};

export type RetrieveParams = {
  id: string;
};

export type RetrieveResponse = {
  clock: Clock;
};

export type UpdateParams = {
  actor: Actor;
  data: ClockUpdateData;
  id: string;
};

export type UpdateResponse = {
  clock: Clock;
};

class ClockService {
  public clockIn = clockIn;
  public clockOut = clockOut;
  public create = create;
  public current = current;
  public delete = remove;
  public list = list;
  public retrieve = retrieve;
  public update = update;
}

export const clockService = new ClockService();
