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

export type BulkFailure = {
  code: string;
  id: string;
};

export type ClockInBody = {
  note?: string;
};

export type ClockOutBody = {
  note?: string;
};

export type ClockResponse = {
  clock: Clock;
};

export type CreateBody = ClockCreateData;

export type CurrentResponse = {
  clock: Clock | null;
};

export type DeleteBody = {
  ids: string[];
};

export type DeleteResponse = {
  deleted: string[];
  failed: BulkFailure[];
  success: boolean;
};

export type ListBody = {
  cursor?: string;
  from?: number | string;
  limit?: number;
  open?: boolean;
  order?: 'asc' | 'desc';
  to?: number | string;
  user_ids?: string[];
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

export type UpdateBody = {
  data: ClockUpdateData;
  ids: string[];
};

export type UpdateResponse = {
  failed: BulkFailure[];
  success: boolean;
  updated: string[];
};

class ClockController {
  public clockIn = clockIn;
  public clockOut = clockOut;
  public create = create;
  public current = current;
  public delete = remove;
  public list = list;
  public retrieve = retrieve;
  public update = update;
}

export const clock = new ClockController();
