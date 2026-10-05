import { describe, expect, it } from 'bun:test';

import { registerEvent } from '@/lib/events/base/registry.js';
import { Reply } from '@/utils/http/reply.js';

import { Fake } from '../../support/fake.js';

import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply } from 'fastify';

describe('utils.reply', () => {
  it('sends the envelope and logs the event', async () => {
    const Created = registerEvent<{ id: string }>({ code: 'thing.created' });
    const req = Fake.request({ actor: { id: 'u1', role: 'admin', team_ids: [] } });
    const reply = Fake.reply<FastifyReply<{ Reply: ReplyEnvelope<{ thing: { id: string } }> }>>();
    await Reply.send(req, reply, Created({ payload: { id: 't1' } }), { thing: { id: 't1' } });
    expect(reply.statusCode).toBe(200);
    expect(reply.payload).toMatchObject({
      data: { thing: { id: 't1' } },
      event: {
        code: 'thing.created',
        correlation_id: 'req-test',
        metadata: {},
        payload: { id: 't1' },
      },
    });
    expect(typeof (reply.payload as { timestamp: number }).timestamp).toBe('number');
    expect(req.log.calls[0]?.args[0]).toMatchObject({
      actor_id: 'u1',
      correlation_id: 'req-test',
      event: 'thing.created',
    });
  });
});
