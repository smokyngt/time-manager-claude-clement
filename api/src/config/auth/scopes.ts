export const SCOPES = ['auth:self', 'users:manage', 'users:read', 'users:write'] as const;

export type Scope = (typeof SCOPES)[number];
