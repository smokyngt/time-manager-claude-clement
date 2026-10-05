import { describe, expect, it } from 'bun:test';

import { Tokens } from '@/lib/auth/tokens.js';
import { RateLimit } from '@/utils/http/rate-limit.js';

import { Fake } from '../../support/fake.js';

describe('utils.rate-limit', () => {
  it('builds the problem body', () => {
    const body = RateLimit.error(Fake.request({ url: '/v1/users/list?x=1' }), { ttl: 2500 });
    expect(body).toMatchObject({
      code: 'rate.limit.exceeded',
      correlation_id: 'req-test',
      instance: '/v1/users/list',
      retry_after: 3,
      status: 429,
      statusCode: 429,
    });
    expect(typeof body.timestamp).toBe('number');
  });

  it('keys by user when the token is valid and by ip otherwise', async () => {
    const { token } = await Tokens.access({ id: 'u-1', role: 'employee' });
    const user = Fake.request({ headers: { authorization: `Bearer ${token}` } });
    expect(await RateLimit.key(user)).toBe('user:u-1');
    expect(await RateLimit.key(Fake.request({ headers: { authorization: 'Bearer nope' } }))).toBe(
      'ip:127.0.0.1',
    );
    expect(await RateLimit.key(Fake.request())).toBe('ip:127.0.0.1');
  });
});
