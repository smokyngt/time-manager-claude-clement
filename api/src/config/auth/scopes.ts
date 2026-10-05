export const SCOPES = [
  'auth:self',
  'clocks:manage',
  'clocks:read',
  'clocks:write',
  'reports:read',
  'teams:manage',
  'teams:read',
  'users:manage',
  'users:read',
  'users:write',
] as const;

export type Scope = (typeof SCOPES)[number];
