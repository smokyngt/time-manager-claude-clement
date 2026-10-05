import { create } from './create.js';
import { current } from './current.js';
import { remove } from './delete.js';
import { clockIn } from './in.js';
import { list } from './list.js';
import { clockOut } from './out.js';
import { retrieve } from './retrieve.js';
import { update } from './update.js';

import type { BulkFailure } from '@/types/entities/index.js';
import type { ClockCreateData, ClockUpdateData } from '@/services/index.js';
import type { Clock } from '@/types/entities/index.js';

export type ClockInBody = {
  note?: string;
};

export type ClockOutBody = {
  note?: string;
};

export type ClockResponse = {
  clock: Clock;
};

export type CreateClockBody = ClockCreateData;

export type CurrentClockResponse = {
  clock: Clock | null;
};

export type DeleteClocksBody = {
  ids: string[];
};

export type DeleteClocksResponse = {
  deleted: string[];
  failed: BulkFailure[];
  success: boolean;
};

export type ListClocksBody = {
  cursor?: string;
  from?: number | string;
  limit?: number;
  open?: boolean;
  order?: 'asc' | 'desc';
  to?: number | string;
  user_ids?: string[];
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

export type UpdateClocksBody = {
  data: ClockUpdateData;
  ids: string[];
};

export type UpdateClocksResponse = {
  failed: BulkFailure[];
  success: boolean;
  updated: string[];
};

export class ClockController {
  public clockIn = clockIn;
  public clockOut = clockOut;
  public create = create;
  public current = current;
  public delete = remove;
  public list = list;
  public retrieve = retrieve;
  public update = update;
}

export const clockController = new ClockController();
