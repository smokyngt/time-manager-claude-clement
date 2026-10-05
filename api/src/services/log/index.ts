import { create } from './create.js';

import type { Actor } from '@/types/entities/index.js';

export type CreateLogParams = {
  actor: null | Pick<Actor, 'id' | 'role'>;
  event: string;
  metadata?: Record<string, unknown>;
};

export type CreateLogResponse = {
  success: boolean;
};

export class LogService {
  public create = create;
}

export const logService = new LogService();
