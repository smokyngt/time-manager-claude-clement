import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { Fake } from '../../../support/fake.js';
import { caught } from '../../services/user/support.js';
import { cookieReply, installAuthService } from './support.js';

const harness = await installAuthService();
const { svc } = harness;

afterAll(() => {
  harness.restore();
});

afterEach(() => {
  mock.clearAllMocks();
});

const { microsoft } = await import('@/controllers/auth/microsoft.js');

describe('auth.controller.microsoft', () => {
  it('sets the signed state cookie scoped to the microsoft path and redirects', async () => {
    const reply = cookieReply();
    await microsoft(Fake.request(), reply);
    expect(reply.redirected).toBe('https://login.example/auth');
    expect(reply.cookies['tm_oauth']?.value).toBe('signed');
    expect(reply.cookies['tm_oauth']?.options).toMatchObject({
      httpOnly: true,
      maxAge: 600,
      path: '/v1/auth/microsoft',
      sameSite: 'lax',
    });
  });

  it('keeps the unavailable error', async () => {
    const { AuthMicrosoftUnavailableError } = await import('@/lib/errors/domains/auth.js');
    svc.authorize.mockImplementationOnce(() => Promise.reject(AuthMicrosoftUnavailableError()));
    const error = await caught(microsoft(Fake.request(), cookieReply()));
    expect([error.code, error.status]).toEqual(['auth.microsoft.unavailable', 503]);
  });

  it('wraps unexpected failures', async () => {
    svc.authorize.mockImplementationOnce(() => Promise.reject(new Error('boom')));
    const error = await caught(microsoft(Fake.request(), cookieReply()));
    expect(error.code).toBe('auth.microsoft.failed');
    expect(error.metadata['route']).toBe('auth.controller.microsoft');
  });
});
