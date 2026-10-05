import { describe, expect, it } from 'bun:test';

import { Redact } from '@/lib/auth/redact.js';

describe('Redact.url', () => {
  it('hides oauth code and state but keeps the rest', () => {
    expect(Redact.url('/v1/auth/microsoft/callback?code=abc&state=xyz&other=1')).toBe(
      '/v1/auth/microsoft/callback?code=redacted&state=redacted&other=1',
    );
    expect(Redact.url('/health')).toBe('/health');
    expect(Redact.url(undefined)).toBeUndefined();
  });

  it('hides repeated parameters and error descriptions', () => {
    const redacted = Redact.url('/cb?code=a&code=b&error_description=secret+text&session_state=s');
    expect(redacted).not.toMatch(/=(a|b|secret|s)(&|$)/);
    expect(redacted).toContain('code=redacted');
  });
});

describe('Redact.request', () => {
  it('serializes a request with the redacted url', () => {
    expect(
      Redact.request({
        hostname: 'api',
        ip: '10.0.0.1',
        method: 'GET',
        socket: { remotePort: 1 },
        url: '/cb?code=abc&state=xyz',
      }),
    ).toEqual({
      host: 'api',
      method: 'GET',
      remoteAddress: '10.0.0.1',
      remotePort: 1,
      url: '/cb?code=redacted&state=redacted',
    });
  });
});
