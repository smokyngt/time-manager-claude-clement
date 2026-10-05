import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Clock } from '@/features/clocks/api/types'

import { ClockCard } from '@/features/clocks/components/clock-card'

const state = vi.hoisted(() => ({
  clock_in: vi.fn(),
  clock_out: vi.fn(),
  current: {},
}))

vi.mock('@/features/clocks/hooks/use-current-clock', () => ({
  useCurrentClock: () => state.current,
}))

vi.mock('@/features/clocks/hooks/use-clock-actions', () => ({
  useClockIn: () => ({ isPending: false, mutate: state.clock_in }),
  useClockOut: () => ({ isPending: false, mutate: state.clock_out }),
}))

function openClock(clocked_in_at: number): Clock {
  return {
    clocked_in_at,
    clocked_out_at: null,
    created_at: clocked_in_at,
    duration_ms: null,
    id: 'c1',
    note: null,
    object: 'clock',
    source: 'clock',
    updated_at: null,
    user_id: 'u1',
  }
}

describe('ClockCard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date('2026-10-05T10:00:00'))
    state.clock_in.mockReset()
    state.clock_out.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the loading state', () => {
    state.current = { data: undefined, isError: false, isPending: true }
    render(<ClockCard />)
    expect(screen.getByText('Loading time clock')).toBeInTheDocument()
  })

  it('shows an error with retry', () => {
    state.current = {
      data: undefined,
      error: new Error('Boom'),
      isError: true,
      isPending: false,
      refetch: vi.fn(),
    }
    render(<ClockCard />)
    expect(screen.getByRole('alert')).toHaveTextContent('Boom')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('clocks in with a note when clocked out', async () => {
    state.current = { data: null, isError: false, isPending: false }
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) })
    render(<ClockCard />)
    expect(screen.getByText('Clocked out')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('00:00:00')
    await user.type(screen.getByLabelText('Note (optional)'), ' hello ')
    await user.click(screen.getByRole('button', { name: 'Clock in' }))
    expect(state.clock_in).toHaveBeenCalledWith('hello', expect.any(Object))
  })

  it('shows elapsed time, ticks every second and clocks out', async () => {
    state.current = {
      data: openClock(Date.now() - 65_000),
      isError: false,
      isPending: false,
    }
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) })
    render(<ClockCard />)
    expect(screen.getByText('Clocked in')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('00:01:05')
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByRole('timer')).toHaveTextContent('00:01:08')
    await user.click(screen.getByRole('button', { name: 'Clock out' }))
    expect(state.clock_out).toHaveBeenCalledWith(undefined, expect.any(Object))
  })

  it('clears the interval on unmount', () => {
    state.current = { data: openClock(Date.now()), isError: false, isPending: false }
    const spy = vi.spyOn(globalThis, 'clearInterval')
    const { unmount } = render(<ClockCard />)
    unmount()
    expect(spy).toHaveBeenCalled()
  })
})
