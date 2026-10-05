import type { TeamReportMember } from '@time-manager/sdk'

export type MemberSortKey = 'lateDays' | 'overtimeMs' | 'workedMs'

export type SortDirection = 'asc' | 'desc'

export function sortMembers(
  members: TeamReportMember[],
  key: MemberSortKey,
  direction: SortDirection,
) {
  const factor = direction === 'asc' ? 1 : -1
  return [...members].sort((a, b) => (a[key] - b[key]) * factor)
}
