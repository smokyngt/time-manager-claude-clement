import type { Clock } from '@time-manager/sdk'
import type { ReactNode } from 'react'

import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { ConflictError } from '@time-manager/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { queryClient } from '@/config/query'
import { QueryKeys } from '@/config/query-keys'
import { useClockIn } from '@/features/clocks/hooks/use-clock-in'
import { useClockOut } from '@/features/clocks/hooks/use-clock-out'
import { AuthContext } from '@/providers/use-auth'
import { TestAuth, TestQuery, TestToast } from '@/test-support'

vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())

const sdk = vi.hoisted(() => ({ clocks: { in: vi.fn(), out: vi.fn() } }))

vi.mock('@/config/sdk', () => ({ sdk }))

const toasts = TestToast.actions()
const ToastWrapper = TestToast.wrapper(toasts)

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext value={TestAuth.value()}>
        <ToastWrapper>{children}</ToastWrapper>
      </AuthContext>
    </QueryClientProvider>
  )
}

function clock(overrides: Partial<Clock> = {}): Clock {
  return {
    clockedInAt: 1_000,
    clockedOutAt: null,
    createdAt: 1_000,
    durationMs: null,
    id: 'c1',
    note: null,
    object: 'clock',
    source: 'clock',
    updatedAt: null,
    userId: 'u1',
    ...overrides,
  }
}

function conflict() {
  return new ConflictError({ code: 'clock.conflict', status: 409 })
}

describe('clock hooks', () => {
  beforeEach(() => {
    TestQuery.reset()
    sdk.clocks.in.mockReset()
    sdk.clocks.out.mockReset()
    vi.mocked(toasts.showError).mockClear()
  })

  it('clocks in, updates the cache optimistically and invalidates clocks and reports', async () => {
    sdk.clocks.in.mockResolvedValue({ clock: clock() })
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const capture = TestToast.capture()
    queryClient.setQueryData(QueryKeys.currentClock(), null)
    const { result } = renderHook(() => useClockIn(), { wrapper })

    act(() => {
      result.current.clockIn({ note: 'hello' })
    })
    await waitFor(() => {
      expect((queryClient.getQueryData(QueryKeys.currentClock()) as Clock | null)?.id).toBe(
        'optimistic',
      )
    })
    await waitFor(() => {
      expect(sdk.clocks.in).toHaveBeenCalledWith({ note: 'hello' })
      expect(spy).toHaveBeenCalledWith({ queryKey: QueryKeys.clocksAll() })
      expect(spy).toHaveBeenCalledWith({ queryKey: QueryKeys.reportsAll() })
    })
    expect(capture.successes).toEqual([{ message: 'toast.clocked_in' }])
    expect(capture.errors).toEqual([])
    capture.stop()
  })

  it('clocks out and clears the current clock optimistically', async () => {
    sdk.clocks.out.mockResolvedValue({ clock: clock({ clockedOutAt: 2_000, durationMs: 1_000 }) })
    const capture = TestToast.capture()
    queryClient.setQueryData(QueryKeys.currentClock(), clock())
    const { result } = renderHook(() => useClockOut(), { wrapper })

    act(() => {
      result.current.clockOut({})
    })
    await waitFor(() => {
      expect(queryClient.getQueryData(QueryKeys.currentClock())).toBeNull()
    })
    await waitFor(() => {
      expect(sdk.clocks.out).toHaveBeenCalledWith({})
      expect(capture.successes).toEqual([{ message: 'toast.clocked_out' }])
    })
    capture.stop()
  })

  it('reports a conflict inline, rolls back and does not toast', async () => {
    sdk.clocks.in.mockRejectedValue(conflict())
    const capture = TestToast.capture()
    queryClient.setQueryData(QueryKeys.currentClock(), null)
    const { result } = renderHook(() => useClockIn(), { wrapper })

    act(() => {
      result.current.clockIn({})
    })
    await waitFor(() => {
      expect(result.current.conflict).toBe(true)
    })
    expect(queryClient.getQueryData(QueryKeys.currentClock())).toBeNull()
    expect(capture.errors).toEqual([])
    expect(capture.successes).toEqual([])
    capture.stop()
  })

  it('rolls back and shows one error toast for other failures', async () => {
    sdk.clocks.out.mockRejectedValue(new Error('boom'))
    const open = clock()
    queryClient.setQueryData(QueryKeys.currentClock(), open)
    const { result } = renderHook(() => useClockOut(), { wrapper })

    act(() => {
      result.current.clockOut({})
    })
    await waitFor(() => {
      expect(result.current.pending).toBe(false)
      expect(sdk.clocks.out).toHaveBeenCalled()
    })
    expect(queryClient.getQueryData(QueryKeys.currentClock())).toEqual(open)
    expect(result.current.conflict).toBe(false)
    expect(toasts.showError).toHaveBeenCalledTimes(1)
  })
})
