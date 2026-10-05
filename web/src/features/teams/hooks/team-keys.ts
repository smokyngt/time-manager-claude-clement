export const teamKeys = {
  all: ['teams'] as const,
  detail: (id: string) => ['teams', 'detail', id] as const,
  list: (archived: boolean) => ['teams', 'list', { archived }] as const,
  lists: () => ['teams', 'list'] as const,
  members: (id: string) => ['teams', 'members', id] as const,
  userOptions: (roles: string[]) => ['teams', 'user-options', ...roles] as const,
}
