import type { Actor } from '@/types/entities/actor.js';

import { create } from './create.js';

export interface CreateParams {
  actor: null | Pick<Actor, 'id' | 'role'>;
  event: string;
  metadata?: Record<string, unknown>;
}

export interface CreateResponse {
  success: boolean;
}

export interface LogServiceType {
  create: (params: CreateParams) => Promise<CreateResponse>;
}

class LogService implements LogServiceType {
  public create = create;
}

export const logService = new LogService();
