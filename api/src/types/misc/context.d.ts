import type { Scope } from '@/config/auth/scopes.js';
import type { Actor } from '@/types/entities/index.js';
import type { FastifyBaseLogger } from 'fastify';

declare module '@fastify/request-context' {
  interface RequestContextData {
    log: FastifyBaseLogger;
    scopes: readonly Scope[];
    user: Actor;
  }
}
