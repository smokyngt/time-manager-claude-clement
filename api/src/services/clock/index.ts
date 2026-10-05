import { create } from './create.js';
import { current } from './current.js';
import { remove } from './delete.js';
import { clockIn } from './in.js';
import { list } from './list.js';
import { clockOut } from './out.js';
import { retrieve } from './retrieve.js';
import { update } from './update.js';

import type { Actor, Clock  } from '@/types/entities/index.js';

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

export type CreateClockParams = {
  actor: Actor;
  data: ClockCreateData;
};

export type CreateClockResponse = {
  clock: Clock;
};

export type CurrentClockParams = {
  actor: Actor;
};

export type CurrentClockResponse = {
  clock: Clock | null;
};

export type DeleteClockParams = {
  actor: Actor;
  id: string;
};

export type DeleteClockResponse = {
  success: boolean;
};

export type ListClocksParams = {
  cursor?: string;
  filters: ClockFilters;
  limit: number;
  order: 'asc' | 'desc';
};

export type ListClocksResponse = {
  items: Clock[];
  more: boolean;
  next: null | string;
  total: number;
};

export type RetrieveClockParams = {
  id: string;
};

export type RetrieveClockResponse = {
  clock: Clock;
};

export type UpdateClockParams = {
  actor: Actor;
  data: ClockUpdateData;
  id: string;
};

export type UpdateClockResponse = {
  clock: Clock;
};

export class ClockService {
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
