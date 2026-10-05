import { act, renderHook, waitFor } from '@testing-library/react'
import { TimeManagerError } from '@time-manager/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { queryClient } from '@/config/query'
import { QueryKeys } from '@/config/query-keys'
import { TeamFixtures } from '@/features/teams/__tests__/fixtures'
import { useAddMembers } from '@/features/teams/hooks/use-add-members'
import { useArchiveTeam } from '@/features/teams/hooks/use-archive-team'
import { useCreateTeam } from '@/features/teams/hooks/use-create-team'
import { useDeleteTeam } from '@/features/teams/hooks/use-delete-team'
import { useRemoveMembers } from '@/features/teams/hooks/use-remove-members'
import { useRestoreTeam } from '@/features/teams/hooks/use-restore-team'
import { useTeamHistory } from '@/features/teams/hooks/use-team-history'
import { useUpdateTeam } from '@/features/teams/hooks/use-update-team'
import { TestQuery } from '@/test-support/test-query'
import { TestToast } from '@/test-support/test-toast'

const sdk = vi.hoisted(() => ({
  teamMembers: { add: vi.fn(), remove: vi.fn() },
  teams: {
    archive: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    restore: vi.fn(),
    update: vi.fn(),
  },
}))
const navigate = vi.hoisted(() => vi.fn())

vi.mock('@/config/sdk', () => ({ sdk }))
vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())
vi.mock('react-router', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useNavigate: () => navigate,
}))

const failure = new TimeManagerError({ code: 'team.update.failed', status: 500 })

describe('team mutations', () => {
  beforeEach(() => {
    TestQuery.reset()
    vi.clearAllMocks()
  })

  describe('useCreateTeam', () => {
    it('creates the team, invalidates lists and toasts once', async () => {
      const team = TeamFixtures.team()
      sdk.teams.create.mockResolvedValue({ team })
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
      const toasts = TestToast.capture()
      const { result } = renderHook(() => useCreateTeam(), { wrapper: TeamFixtures.wrapper() })
      act(() => {
        result.current.createTeam({ name: 'Support' })
      })
      await waitFor(() => {
        expect(toasts.successes).toHaveLength(1)
      })
      expect(sdk.teams.create).toHaveBeenCalledWith({ name: 'Support' })
      expect(invalidate).toHaveBeenCalledWith({ queryKey: QueryKeys.teams() })
      expect(toasts.successes[0]?.message).toBe('toast.created')
      expect(toasts.errors).toHaveLength(0)
      toasts.stop()
    })

    it('shows the error in context instead of a global toast', async () => {
      sdk.teams.create.mockRejectedValue(failure)
      const actions = TestToast.actions()
      const toasts = TestToast.capture()
      const { result } = renderHook(() => useCreateTeam(), {
        wrapper: TeamFixtures.wrapper(actions),
      })
      act(() => {
        result.current.createTeam({ name: 'Support' })
      })
      await waitFor(() => {
        expect(actions.showError).toHaveBeenCalledWith('create.title', expect.any(String))
      })
      expect(toasts.errors).toHaveLength(0)
      expect(toasts.successes).toHaveLength(0)
      toasts.stop()
    })
  })

  describe('useUpdateTeam', () => {
    it('updates the teams and invalidates every team key', async () => {
      sdk.teams.update.mockResolvedValue({ failed: [], success: true, updated: ['team-1'] })
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
      const toasts = TestToast.capture()
      const { result } = renderHook(() => useUpdateTeam(), { wrapper: TeamFixtures.wrapper() })
      act(() => {
        result.current.updateTeam({ data: { name: 'New' }, ids: ['team-1'] })
      })
      await waitFor(() => {
        expect(toasts.successes).toHaveLength(1)
      })
      expect(sdk.teams.update).toHaveBeenCalledWith(['team-1'], { name: 'New' })
      expect(invalidate).toHaveBeenCalledWith({ queryKey: QueryKeys.teamsAll() })
      toasts.stop()
    })

    it('reports a failed update in context', async () => {
      sdk.teams.update.mockResolvedValue({
        failed: [{ code: 'team.not.found', id: 'team-1' }],
        success: false,
        updated: [],
      })
      const actions = TestToast.actions()
      const toasts = TestToast.capture()
      const { result } = renderHook(() => useUpdateTeam(), {
        wrapper: TeamFixtures.wrapper(actions),
      })
      act(() => {
        result.current.updateTeam({ data: { name: 'New' }, ids: ['team-1'] })
      })
      await waitFor(() => {
        expect(actions.showError).toHaveBeenCalledWith('edit.title', expect.any(String))
      })
      expect(toasts.successes).toHaveLength(0)
      toasts.stop()
    })
  })

  describe.each([
    { hook: useArchiveTeam, method: 'archive', run: 'archiveTeams', toast: 'toast.archived' },
    { hook: useRestoreTeam, method: 'restore', run: 'restoreTeams', toast: 'toast.restored' },
  ] as const)('$method', ({ hook, method, run, toast }) => {
    it('calls the SDK for every id, invalidates and toasts once', async () => {
      sdk.teams[method].mockResolvedValue({ team: TeamFixtures.team() })
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
      const toasts = TestToast.capture()
      const { result } = renderHook(() => hook(), { wrapper: TeamFixtures.wrapper() })
      act(() => {
        ;(result.current as unknown as Record<string, (ids: string[]) => void>)[run]?.(['a', 'b'])
      })
      await waitFor(() => {
        expect(toasts.successes).toHaveLength(1)
      })
      expect(sdk.teams[method]).toHaveBeenCalledWith('a')
      expect(sdk.teams[method]).toHaveBeenCalledWith('b')
      expect(invalidate).toHaveBeenCalledWith({ queryKey: QueryKeys.teamsAll() })
      expect(toasts.successes[0]?.message).toBe(toast)
      toasts.stop()
    })

    it('toasts the error globally', async () => {
      sdk.teams[method].mockRejectedValue(failure)
      const toasts = TestToast.capture()
      const { result } = renderHook(() => hook(), { wrapper: TeamFixtures.wrapper() })
      act(() => {
        ;(result.current as unknown as Record<string, (ids: string[]) => void>)[run]?.(['a'])
      })
      await waitFor(() => {
        expect(toasts.errors).toHaveLength(1)
      })
      expect(toasts.successes).toHaveLength(0)
      toasts.stop()
    })
  })

  describe('useDeleteTeam', () => {
    it('cancels, removes the detail, navigates, then invalidates the lists', async () => {
      sdk.teams.delete.mockResolvedValue({ deleted: ['team-1'], failed: [], success: true })
      const order: string[] = []
      vi.spyOn(queryClient, 'cancelQueries').mockImplementation(() => {
        order.push('cancel')
        return Promise.resolve()
      })
      vi.spyOn(queryClient, 'removeQueries').mockImplementation(() => {
        order.push('remove')
      })
      navigate.mockImplementation(() => {
        order.push('navigate')
        return Promise.resolve()
      })
      vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(() => {
        order.push('invalidate')
        return Promise.resolve()
      })
      const toasts = TestToast.capture()
      const { result } = renderHook(() => useDeleteTeam({ navigateTo: '/teams' }), {
        wrapper: TeamFixtures.wrapper(),
      })
      act(() => {
        result.current.deleteTeams(['team-1'])
      })
      await waitFor(() => {
        expect(toasts.successes).toHaveLength(1)
      })
      expect(sdk.teams.delete).toHaveBeenCalledWith(['team-1'])
      expect(order).toEqual(['cancel', 'remove', 'navigate', 'invalidate'])
      expect(navigate).toHaveBeenCalledWith('/teams')
      toasts.stop()
    })

    it('does not navigate without a target', async () => {
      sdk.teams.delete.mockResolvedValue({ deleted: ['team-1'], failed: [], success: true })
      const toasts = TestToast.capture()
      const { result } = renderHook(() => useDeleteTeam(), { wrapper: TeamFixtures.wrapper() })
      act(() => {
        result.current.deleteTeams(['team-1'])
      })
      await waitFor(() => {
        expect(toasts.successes).toHaveLength(1)
      })
      expect(navigate).not.toHaveBeenCalled()
      toasts.stop()
    })

    it('toasts the error globally and keeps the page', async () => {
      sdk.teams.delete.mockRejectedValue(failure)
      const toasts = TestToast.capture()
      const { result } = renderHook(() => useDeleteTeam({ navigateTo: '/teams' }), {
        wrapper: TeamFixtures.wrapper(),
      })
      act(() => {
        result.current.deleteTeams(['team-1'])
      })
      await waitFor(() => {
        expect(toasts.errors).toHaveLength(1)
      })
      expect(navigate).not.toHaveBeenCalled()
      expect(toasts.successes).toHaveLength(0)
      toasts.stop()
    })
  })

  describe('members', () => {
    it('useAddMembers adds users and refreshes the team', async () => {
      sdk.teamMembers.add.mockResolvedValue({ added: ['u1', 'u2'], failed: [], success: true })
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
      const toasts = TestToast.capture()
      const { result } = renderHook(() => useAddMembers('team-1'), {
        wrapper: TeamFixtures.wrapper(),
      })
      act(() => {
        result.current.addMembers(['u1', 'u2'])
      })
      await waitFor(() => {
        expect(toasts.successes).toHaveLength(1)
      })
      expect(sdk.teamMembers.add).toHaveBeenCalledWith('team-1', ['u1', 'u2'])
      expect(invalidate).toHaveBeenCalledWith({ queryKey: QueryKeys.team('team-1') })
      expect(invalidate).toHaveBeenCalledWith({ queryKey: QueryKeys.teams() })
      toasts.stop()
    })

    it('useAddMembers reports the error in context', async () => {
      sdk.teamMembers.add.mockRejectedValue(failure)
      const actions = TestToast.actions()
      const toasts = TestToast.capture()
      const { result } = renderHook(() => useAddMembers('team-1'), {
        wrapper: TeamFixtures.wrapper(actions),
      })
      act(() => {
        result.current.addMembers(['u1'])
      })
      await waitFor(() => {
        expect(actions.showError).toHaveBeenCalledWith('members.add.title', expect.any(String))
      })
      expect(toasts.errors).toHaveLength(0)
      toasts.stop()
    })

    it('useAddMembers warns about partial failures', async () => {
      sdk.teamMembers.add.mockResolvedValue({
        added: ['u1'],
        failed: [{ code: 'team.member.user.archived', id: 'u2' }],
        success: false,
      })
      const actions = TestToast.actions()
      const { result } = renderHook(() => useAddMembers('team-1'), {
        wrapper: TeamFixtures.wrapper(actions),
      })
      act(() => {
        result.current.addMembers(['u1', 'u2'])
      })
      await waitFor(() => {
        expect(actions.showError).toHaveBeenCalledWith('members.add.title', 'toast.partial')
      })
    })

    it('useRemoveMembers removes users and refreshes the team', async () => {
      sdk.teamMembers.remove.mockResolvedValue({ failed: [], removed: ['u1'], success: true })
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
      const toasts = TestToast.capture()
      const { result } = renderHook(() => useRemoveMembers('team-1'), {
        wrapper: TeamFixtures.wrapper(),
      })
      act(() => {
        result.current.removeMembers(['u1'])
      })
      await waitFor(() => {
        expect(toasts.successes).toHaveLength(1)
      })
      expect(sdk.teamMembers.remove).toHaveBeenCalledWith('team-1', ['u1'])
      expect(invalidate).toHaveBeenCalledWith({ queryKey: QueryKeys.team('team-1') })
      toasts.stop()
    })

    it('useRemoveMembers reports the error in context', async () => {
      sdk.teamMembers.remove.mockRejectedValue(failure)
      const actions = TestToast.actions()
      const { result } = renderHook(() => useRemoveMembers('team-1'), {
        wrapper: TeamFixtures.wrapper(actions),
      })
      act(() => {
        result.current.removeMembers(['u1'])
      })
      await waitFor(() => {
        expect(actions.showError).toHaveBeenCalledWith('members.remove.title', expect.any(String))
      })
    })
  })

  describe('useTeamHistory', () => {
    it('undoes and redoes a creation by archiving and restoring', async () => {
      const team = TeamFixtures.team()
      sdk.teams.archive.mockResolvedValue({ team })
      sdk.teams.restore.mockResolvedValue({ team })
      const { result } = renderHook(() => useTeamHistory(), { wrapper: TeamFixtures.wrapper() })
      const entry = result.current.created(team)
      await entry.undo()
      expect(sdk.teams.archive).toHaveBeenCalledWith('team-1')
      await entry.redo()
      expect(sdk.teams.restore).toHaveBeenCalledWith('team-1')
      expect(entry.label).toBe('history.created')
    })

    it('undoes and redoes an update with the stored values', async () => {
      const team = TeamFixtures.team()
      sdk.teams.update.mockResolvedValue({ failed: [], success: true, updated: ['team-1'] })
      const { result } = renderHook(() => useTeamHistory(), { wrapper: TeamFixtures.wrapper() })
      const entry = result.current.updated(team, { name: 'Before' }, { name: 'After' })
      await entry.undo()
      expect(sdk.teams.update).toHaveBeenLastCalledWith(['team-1'], { name: 'Before' })
      await entry.redo()
      expect(sdk.teams.update).toHaveBeenLastCalledWith(['team-1'], { name: 'After' })
    })
  })
})
