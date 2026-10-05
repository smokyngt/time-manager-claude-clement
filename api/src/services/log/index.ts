import { create } from './create.js';

import type { Actor } from '@/types/entities/actor.js';

export type CreateParams = {
  actor: null | Pick<Actor, 'id' | 'role'>;
  event: string;
  metadata?: Record<string, unknown>;
};

export type CreateResponse = {
  success: boolean;
};

class LogService {
  public create = create;
}

export const logService = new LogService();
