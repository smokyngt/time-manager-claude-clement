import { renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { queryClient } from '@/config/query'
import { QueryKeys } from '@/config/query-keys'
import { useArchiveUser } from '@/features/users/hooks/use-archive-user'
import { useCreateUser } from '@/features/users/hooks/use-create-user'
import { useDeleteUsers } from '@/features/users/hooks/use-delete-users'
import { useUpdateUsers } from '@/features/users/hooks/use-update-users'
import { useUser } from '@/features/users/hooks/use-user'
import { useUsers } from '@/features/users/hooks/use-users'
import { useUndoStore } from '@/stores/undo'
import { TestAuth, TestQuery, TestToast } from '@/test-support'

vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())

const sdk = vi.hoisted(() => ({
  teams: { list: vi.fn() },
  users: {
    archive: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    restore: vi.fn(),
    retrieve: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/config/sdk', () => ({ sdk }))

const user = TestAuth.user()
const actions = TestToast.actions()
const Query = TestQuery.wrapper()
const Toast = TestToast.wrapper(actions)

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <Query>
        <Toast>{children}</Toast>
      </Query>
    </MemoryRouter>
  )
}

beforeEach(() => {
  TestQuery.reset()
  useUndoStore.getState().clear()
  vi.clearAllMocks()
})

describe('useUsers', () => {
  it('lists with filters and exposes a named object', async () => {
    sdk.users.list.mockResolvedValue({ items: [user], more: true, next: 'c2', total: 3 })
    const { result } = renderHook(() => useUsers({ archived: false, role: 'employee' }), {
      wrapper: Wrapper,
    })
    expect(result.current.users).toEqual([])
    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })
    expect(sdk.users.list).toHaveBeenCalledWith({ archived: false, role: 'employee' })
    expect(result.current).toMatchObject({ more: true, next: 'c2', total: 3, users: [user] })
  })

  it('keeps a stable empty list', () => {
    sdk.users.list.mockReturnValue(new Promise(() => undefined))
    const { rerender, result } = renderHook(() => useUsers(), { wrapper: Wrapper })
    const first = result.current.users
    rerender()
    expect(result.current.users).toBe(first)
  })

  it('reports query failures through the global toast', async () => {
    const capture = TestToast.capture()
    sdk.users.list.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useUsers(), { wrapper: Wrapper })
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(capture.errors).toHaveLength(1)
    capture.stop()
  })
})

describe('useUser', () => {
  it('stays idle without an id', () => {
    const { result } = renderHook(() => useUser(undefined), { wrapper: Wrapper })
    expect(result.current.loading).toBe(false)
    expect(sdk.users.retrieve).not.toHaveBeenCalled()
  })

  it('retrieves the user', async () => {
    sdk.users.retrieve.mockResolvedValue({ user })
    const { result } = renderHook(() => useUser(user.id), { wrapper: Wrapper })
    await waitFor(() => {
      expect(result.current.user).toEqual(user)
    })
    expect(sdk.users.retrieve).toHaveBeenCalledWith(user.id)
  })
})

describe('useCreateUser', () => {
  it('creates, toasts once, pushes undo and invalidates lists', async () => {
    const capture = TestToast.capture()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    sdk.users.create.mockResolvedValue({ user })
    const { result } = renderHook(() => useCreateUser(), { wrapper: Wrapper })
    result.current.mutate({ email: 'a@b.co', firstName: 'A', lastName: 'B' })
    await waitFor(() => {
      expect(capture.successes).toHaveLength(1)
    })
    expect(sdk.users.create).toHaveBeenCalledWith({
      email: 'a@b.co',
      firstName: 'A',
      lastName: 'B',
    })
    expect(useUndoStore.getState().past).toHaveLength(1)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: QueryKeys.usersAll() })
    expect(capture.errors).toHaveLength(0)
    capture.stop()
  })

  it('shows one dialog error on failure', async () => {
    const capture = TestToast.capture()
    sdk.users.create.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useCreateUser(), { wrapper: Wrapper })
    result.current.mutate({ email: 'a@b.co', firstName: 'A', lastName: 'B' })
    await waitFor(() => {
      expect(actions.showError).toHaveBeenCalledTimes(1)
    })
    expect(capture.errors).toHaveLength(0)
    capture.stop()
  })
})

describe('useUpdateUsers', () => {
  it('reports failed ids and skips undo', async () => {
    sdk.users.update.mockResolvedValue({
      failed: [{ code: 'user.conflict', id: user.id }],
      success: false,
      updated: [],
    })
    const { result } = renderHook(() => useUpdateUsers(), { wrapper: Wrapper })
    result.current.mutate({
      data: { email: 'x@y.co' },
      ids: [user.id],
      revert: { email: 'a@b.co' },
    })
    await waitFor(() => {
      expect(actions.showError).toHaveBeenCalledTimes(1)
    })
    expect(sdk.users.update).toHaveBeenCalledWith([user.id], { email: 'x@y.co' })
    expect(useUndoStore.getState().past).toHaveLength(0)
  })

  it('pushes an undo entry on success', async () => {
    sdk.users.update.mockResolvedValue({ failed: [], success: true, updated: [user.id] })
    const { result } = renderHook(() => useUpdateUsers(), { wrapper: Wrapper })
    result.current.mutate({
      data: { firstName: 'Z' },
      ids: [user.id],
      revert: { firstName: 'Jane' },
    })
    await waitFor(() => {
      expect(actions.showSuccess).toHaveBeenCalledTimes(1)
    })
    expect(useUndoStore.getState().past).toHaveLength(1)
  })
})

describe('useArchiveUser', () => {
  it('archives each id and reports partial failures', async () => {
    sdk.users.archive.mockImplementation((id: string) =>
      id === 'a' ? Promise.resolve({ user }) : Promise.reject(new Error('x')),
    )
    const { result } = renderHook(() => useArchiveUser(), { wrapper: Wrapper })
    result.current.mutate(['a', 'b'])
    await waitFor(() => {
      expect(actions.showError).toHaveBeenCalledTimes(1)
    })
    expect(sdk.users.archive).toHaveBeenCalledTimes(2)
    expect(useUndoStore.getState().past).toHaveLength(1)
  })
})

describe('useDeleteUsers', () => {
  it('removes details, calls onDeleted, then invalidates lists', async () => {
    const order: string[] = []
    queryClient.setQueryData(QueryKeys.user(user.id), user)
    sdk.users.delete.mockResolvedValue({ deleted: [user.id], failed: [], success: true })
    const remove = vi.spyOn(queryClient, 'removeQueries').mockImplementation(() => {
      order.push('remove')
    })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(() => {
      order.push('invalidate')
      return Promise.resolve()
    })
    const { result } = renderHook(
      () =>
        useDeleteUsers({
          onDeleted: () => {
            order.push('navigate')
          },
        }),
      { wrapper: Wrapper },
    )
    result.current.mutate([user.id])
    await waitFor(() => {
      expect(order).toContain('invalidate')
    })
    expect(order.slice(0, 3)).toEqual(['remove', 'navigate', 'invalidate'])
    expect(sdk.users.delete).toHaveBeenCalledWith([user.id])
    remove.mockRestore()
    invalidate.mockRestore()
  })

  it('toasts failed items', async () => {
    sdk.users.delete.mockResolvedValue({
      deleted: [],
      failed: [{ code: 'user.not.found', id: user.id }],
      success: false,
    })
    const { result } = renderHook(() => useDeleteUsers(), { wrapper: Wrapper })
    result.current.mutate([user.id])
    await waitFor(() => {
      expect(actions.showError).toHaveBeenCalledTimes(1)
    })
  })
})
