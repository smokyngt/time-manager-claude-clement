import { afterEach, describe, expect, it } from 'bun:test';

import { SignJWT } from 'jose';

import { Tokens } from '@/lib/auth/tokens.js';

import { caught } from '../../services/user/support.js';

const saved = { ...process.env };
const ID = '00000000-0000-4000-8000-0000000000c2';

afterEach(() => {
  process.env = { ...saved };
});

const forge = (claims: Record<string, unknown>, secret = Tokens.secret('JWT_ACCESS_SECRET')) =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(ID)
    .setIssuer('time-manager')
    .setAudience('time-manager-web')
    .setExpirationTime('5m')
    .sign(secret);

describe('Tokens', () => {
  it('signs an access token that verifies to the actor', async () => {
    const { expires_in: expiresIn, token } = await Tokens.access({ id: ID, role: 'manager' });
    expect(expiresIn).toBe(900);
    expect(await Tokens.verify(token)).toEqual({ id: ID, role: 'manager', team_ids: [] });
  });

  it('rejects bad tokens with token.authentication.failed (401)', async () => {
    const other = new TextEncoder().encode('z'.repeat(40));
    const bad = [
      'garbage',
      await forge({ role: 'admin' }, other),
      await forge({ role: 'root' }),
      await forge({}),
    ];
    for (const token of bad) {
      const error = await caught(Tokens.verify(token));
      expect(error.code).toBe('token.authentication.failed');
      expect(error.status).toBe(401);
    }
  });

  it('hashes refresh tokens with the refresh secret and never stores the token', () => {
    const refresh = Tokens.refresh();
    expect(refresh.hash).toBe(Tokens.hash(refresh.token));
    expect(refresh.hash).not.toBe(refresh.token);
    process.env['JWT_REFRESH_SECRET'] = 'rotated-secret-rotated-secret-rotated';
    expect(Tokens.hash(refresh.token)).not.toBe(refresh.hash);
    expect(Buffer.from(refresh.token, 'base64url')).toHaveLength(32);
  });
});
