import type { TeamMemberReport } from '@/features/reports/api/types'

export type MemberSortKey = 'late_days' | 'overtime_ms' | 'worked_ms'

export function sortMembers(
  members: TeamMemberReport[],
  key: MemberSortKey,
  direction: 'asc' | 'desc',
) {
  const factor = direction === 'asc' ? 1 : -1
  return [...members].sort((a, b) => (a[key] - b[key]) * factor)
}
