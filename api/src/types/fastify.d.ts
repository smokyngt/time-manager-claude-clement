import type { Actor } from '@/types/entities/actor.js';

declare module 'fastify' {
  interface FastifyRequest {
    actor: Actor | null;
  }
}
