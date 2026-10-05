import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useReportTeam, useReportUser } from '@/features/reports/hooks/use-report-subject'
import { useTeamReport } from '@/features/reports/hooks/use-team-report'
import { useUserReport } from '@/features/reports/hooks/use-user-report'
import { TestQuery } from '@/test-support'

const sdk = vi.hoisted(() => ({
  reports: { team: vi.fn(), user: vi.fn() },
  teams: { retrieve: vi.fn() },
  users: { retrieve: vi.fn() },
}))

vi.mock('@/config/sdk', () => ({ sdk }))

const params = { from: 1, granularity: 'day' as const, to: 2, userId: 'u1' }

beforeEach(() => {
  TestQuery.reset()
  vi.clearAllMocks()
})

describe('useUserReport', () => {
  it('calls the SDK with the params and unwraps the report', async () => {
    sdk.reports.user.mockResolvedValue({ report: { userId: 'u1' } })
    const { result } = renderHook(() => useUserReport(params), { wrapper: TestQuery.wrapper() })
    await waitFor(() => {
      expect(result.current.report).toEqual({ userId: 'u1' })
    })
    expect(sdk.reports.user).toHaveBeenCalledWith(params)
  })

  it('does not fetch while disabled', () => {
    renderHook(() => useUserReport(params, false), { wrapper: TestQuery.wrapper() })
    expect(sdk.reports.user).not.toHaveBeenCalled()
  })

  it('exposes the error', async () => {
    sdk.reports.user.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useUserReport(params), {
      wrapper: TestQuery.wrapper(TestQuery.isolated()),
    })
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})

describe('useTeamReport', () => {
  it('calls the SDK with the team params', async () => {
    const team = { from: 1, granularity: 'week' as const, teamId: 't1', to: 2 }
    sdk.reports.team.mockResolvedValue({ report: { teamId: 't1' } })
    const { result } = renderHook(() => useTeamReport(team), { wrapper: TestQuery.wrapper() })
    await waitFor(() => {
      expect(result.current.report).toEqual({ teamId: 't1' })
    })
    expect(sdk.reports.team).toHaveBeenCalledWith(team)
  })
})

describe('report subjects', () => {
  it('retrieves the user and the team', async () => {
    sdk.users.retrieve.mockResolvedValue({ user: { id: 'u1' } })
    sdk.teams.retrieve.mockResolvedValue({ team: { id: 't1' } })
    const user = renderHook(() => useReportUser('u1'), { wrapper: TestQuery.wrapper() })
    const team = renderHook(() => useReportTeam('t1'), { wrapper: TestQuery.wrapper() })
    await waitFor(() => {
      expect(user.result.current.user).toEqual({ id: 'u1' })
      expect(team.result.current.team).toEqual({ id: 't1' })
    })
    expect(sdk.users.retrieve).toHaveBeenCalledWith('u1')
    expect(sdk.teams.retrieve).toHaveBeenCalledWith('t1')
  })
})
