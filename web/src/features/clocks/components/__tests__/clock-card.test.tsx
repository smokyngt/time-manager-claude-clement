import type { Clock } from '@time-manager/sdk'

import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ClockCard } from '@/features/clocks/components/clock-card'
import { TestClock } from '@/test-support'

vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())

const state = vi.hoisted(
  (): {
    clockIn: ReturnType<typeof vi.fn>
    clockOut: ReturnType<typeof vi.fn>
    current: Record<string, unknown>
    inConflict: boolean
    outConflict: boolean
  } => ({
    clockIn: vi.fn(),
    clockOut: vi.fn(),
    current: {},
    inConflict: false,
    outConflict: false,
  }),
)

vi.mock('@/features/clocks/hooks/use-current-clock', () => ({
  useCurrentClock: () => state.current,
}))

vi.mock('@/features/clocks/hooks/use-clock-in', () => ({
  useClockIn: () => ({
    clockIn: state.clockIn,
    conflict: state.inConflict,
    pending: false,
    reset: vi.fn(),
  }),
}))

vi.mock('@/features/clocks/hooks/use-clock-out', () => ({
  useClockOut: () => ({
    clockOut: state.clockOut,
    conflict: state.outConflict,
    pending: false,
    reset: vi.fn(),
  }),
}))

function openClock(clockedInAt: number): Clock {
  return {
    clockedInAt,
    clockedOutAt: null,
    createdAt: clockedInAt,
    durationMs: null,
    id: 'c1',
    note: null,
    object: 'clock',
    source: 'clock',
    updatedAt: null,
    userId: 'u1',
  }
}

describe('ClockCard', () => {
  beforeEach(() => {
    TestClock.install('2026-10-05T10:00:00')
    state.clockIn.mockReset()
    state.clockOut.mockReset()
    state.inConflict = false
    state.outConflict = false
  })

  afterEach(() => {
    TestClock.restore()
  })

  it('shows the loading state', () => {
    state.current = { clock: null, isError: false, loading: true }
    render(<ClockCard />)
    expect(screen.getByText('card.loading')).toBeInTheDocument()
  })

  it('shows an error with retry', () => {
    const refetch = vi.fn()
    state.current = { clock: null, error: new Error('x'), isError: true, loading: false, refetch }
    render(<ClockCard />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'error.retry' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('shows the clocked out state and clocks in with a trimmed note', () => {
    state.current = { clock: null, isError: false, loading: false }
    render(<ClockCard />)
    expect(screen.getByRole('timer')).toHaveTextContent('00:00:00')
    expect(screen.getByRole('status')).toHaveTextContent('card.announce_out')
    fireEvent.change(screen.getByLabelText('card.note_label'), { target: { value: '  hi  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'card.clock_in' }))
    expect(state.clockIn).toHaveBeenCalledWith({ note: 'hi' }, expect.any(Object))
  })

  it('ticks the timer while clocked in and clocks out', async () => {
    state.current = {
      clock: openClock(Date.now() - 65_000),
      isError: false,
      loading: false,
    }
    render(<ClockCard />)
    await act(async () => {
      await TestClock.advance(1000)
    })
    expect(screen.getByRole('timer')).toHaveTextContent('00:01:06')
    await act(async () => {
      await TestClock.advance(4000)
    })
    expect(screen.getByRole('timer')).toHaveTextContent('00:01:10')
    fireEvent.click(screen.getByRole('button', { name: 'card.clock_out' }))
    expect(state.clockOut).toHaveBeenCalledWith({}, expect.any(Object))
  })

  it('shows the conflict feedback', () => {
    state.current = { clock: null, isError: false, loading: false }
    state.inConflict = true
    render(<ClockCard />)
    expect(screen.getByRole('alert')).toHaveTextContent('card.conflict_in')
  })
})
