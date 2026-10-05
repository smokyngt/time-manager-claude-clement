import { afterEach, describe, expect, it, spyOn } from 'bun:test';

import { Tokens } from '@/lib/auth/tokens.js';
import { RateLimit } from '@/utils/http/rate-limit.js';

import { Fake } from '../../../support/fake.js';

const spies: { mockRestore: () => void }[] = [];

afterEach(() => {
  for (const spy of spies.splice(0)) spy.mockRestore();
});

describe('RateLimit.error', () => {
  it('builds the rate.limit.exceeded problem with the retry delay', () => {
    const req = Fake.request({ url: '/v1/users/list?limit=1' });
    const problem = RateLimit.error(req, { ttl: 2500 });
    expect(problem).toMatchObject({
      code: 'rate.limit.exceeded',
      correlation_id: 'req-test',
      instance: '/v1/users/list',
      retry_after: 3,
      status: 429,
    });
    expect(typeof problem.timestamp).toBe('number');
  });

  it('waits at least one second', () => {
    expect(RateLimit.error(Fake.request(), { ttl: 10 }).retry_after).toBe(1);
  });
});

describe('RateLimit.key', () => {
  it('keys authenticated callers by user id', async () => {
    spies.push(
      spyOn(Tokens, 'verify').mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<
        ReturnType<typeof Tokens.verify>
      >),
    );
    const req = Fake.request({ headers: { authorization: 'Bearer token' } });
    expect(await RateLimit.key(req)).toBe('user:u1');
  });

  it('falls back to the ip for anonymous or invalid callers', async () => {
    expect(await RateLimit.key(Fake.request())).toBe('ip:127.0.0.1');
    spies.push(spyOn(Tokens, 'verify').mockRejectedValue(new Error('bad')));
    const req = Fake.request({ headers: { authorization: 'Bearer bad' } });
    expect(await RateLimit.key(req)).toBe('ip:127.0.0.1');
  });
});
