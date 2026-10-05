import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TeamFixtures } from '@/features/teams/__tests__/fixtures'
import { useTeam } from '@/features/teams/hooks/use-team'
import { useTeamMembers } from '@/features/teams/hooks/use-team-members'
import { useTeams } from '@/features/teams/hooks/use-teams'
import { useUserOptions } from '@/features/teams/hooks/use-user-options'
import { TestQuery } from '@/test-support/test-query'
import { TestToast } from '@/test-support/test-toast'

const sdk = vi.hoisted(() => ({
  teamMembers: { list: vi.fn() },
  teams: { list: vi.fn(), retrieve: vi.fn() },
  users: { list: vi.fn() },
}))

vi.mock('@/config/sdk', () => ({ sdk }))
vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())

const page = <T,>(items: T[], extra = {}) => ({
  items,
  more: false,
  next: null,
  total: items.length,
  ...extra,
})

describe('team queries', () => {
  beforeEach(() => {
    TestQuery.reset()
    vi.clearAllMocks()
  })

  it('useTeams lists teams with the filters and follows cursors', async () => {
    const first = TeamFixtures.team({ id: 'a' })
    const second = TeamFixtures.team({ id: 'b' })
    sdk.teams.list
      .mockResolvedValueOnce(page([first], { more: true, next: 'c1' }))
      .mockResolvedValueOnce(page([second]))
    const { result } = renderHook(() => useTeams({ archived: true, order: 'asc' }), {
      wrapper: TeamFixtures.wrapper(),
    })
    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })
    expect(sdk.teams.list).toHaveBeenNthCalledWith(1, {
      archived: true,
      cursor: undefined,
      limit: 100,
      order: 'asc',
    })
    expect(sdk.teams.list).toHaveBeenNthCalledWith(2, expect.objectContaining({ cursor: 'c1' }))
    expect(result.current.teams).toEqual([first, second])
    expect(result.current.total).toBe(2)
  })

  it('useTeams exposes the error without a global toast', async () => {
    const toasts = TestToast.capture()
    sdk.teams.list.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useTeams({ archived: false, order: 'desc' }), {
      wrapper: TeamFixtures.wrapper(),
    })
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.teams).toEqual([])
    expect(toasts.errors).toHaveLength(0)
    toasts.stop()
  })

  it('useTeam retrieves one team and is disabled without an id', async () => {
    const team = TeamFixtures.team()
    sdk.teams.retrieve.mockResolvedValue({ team })
    const { result } = renderHook(() => useTeam('team-1'), { wrapper: TeamFixtures.wrapper() })
    await waitFor(() => {
      expect(result.current.team).toEqual(team)
    })
    expect(sdk.teams.retrieve).toHaveBeenCalledWith('team-1')
    renderHook(() => useTeam(''), { wrapper: TeamFixtures.wrapper() })
    expect(sdk.teams.retrieve).toHaveBeenCalledTimes(1)
  })

  it('useTeam reports a failure', async () => {
    sdk.teams.retrieve.mockRejectedValue(new Error('missing'))
    const { result } = renderHook(() => useTeam('team-1'), { wrapper: TeamFixtures.wrapper() })
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })

  it('useTeamMembers lists members of the team', async () => {
    const member = TeamFixtures.user()
    sdk.teamMembers.list.mockResolvedValue(page([member]))
    const { result } = renderHook(() => useTeamMembers('team-1'), {
      wrapper: TeamFixtures.wrapper(),
    })
    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })
    expect(sdk.teamMembers.list).toHaveBeenCalledWith('team-1', { cursor: undefined, limit: 100 })
    expect(result.current.members).toEqual([member])
  })

  it('useTeamMembers does nothing when disabled', () => {
    const { result } = renderHook(() => useTeamMembers('team-1', false), {
      wrapper: TeamFixtures.wrapper(),
    })
    expect(sdk.teamMembers.list).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
  })

  it('useUserOptions lists active users of each role', async () => {
    sdk.users.list.mockImplementation(({ role }: { role: string }) =>
      Promise.resolve(page([TeamFixtures.user({ id: role, role: role as 'admin' })])),
    )
    const { result } = renderHook(() => useUserOptions(['admin', 'manager']), {
      wrapper: TeamFixtures.wrapper(),
    })
    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })
    expect(sdk.users.list).toHaveBeenCalledWith(
      expect.objectContaining({ archived: false, role: 'admin' }),
    )
    expect(sdk.users.list).toHaveBeenCalledWith(expect.objectContaining({ role: 'manager' }))
    expect(result.current.users).toHaveLength(2)
  })

  it('useUserOptions stays idle when disabled', () => {
    renderHook(() => useUserOptions(['employee'], false), { wrapper: TeamFixtures.wrapper() })
    expect(sdk.users.list).not.toHaveBeenCalled()
  })
})
