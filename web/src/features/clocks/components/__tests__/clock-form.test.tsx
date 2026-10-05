import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ClockForm } from '@/features/clocks/components/clock-form'
import { ClockValues } from '@/features/clocks/lib/clock-values'

vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())

const users = [{ id: 'u1', label: 'Jane Doe' }]

describe('ClockForm', () => {
  it('disables submit until valid and reports invalid ranges', async () => {
    render(
      <ClockForm
        defaultValues={ClockValues.empty('u1')}
        editing={false}
        onSubmit={vi.fn()}
        pending={false}
        users={users}
      />,
    )
    const submit = screen.getByRole('button', { name: 'create.submit' })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByLabelText('form.clocked_in_at'), {
      target: { value: '2026-01-05T09:00' },
    })
    fireEvent.change(screen.getByLabelText('form.clocked_out_at'), {
      target: { value: '2026-01-05T08:00' },
    })
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('form.errors.out_before_in')
    })
    expect(screen.getByLabelText('form.clocked_out_at')).toHaveAttribute('aria-invalid', 'true')
    expect(submit).toBeDisabled()
  })

  it('submits trimmed values as timestamps', async () => {
    const onSubmit = vi.fn()
    render(
      <ClockForm
        defaultValues={ClockValues.empty('u1')}
        editing={false}
        onSubmit={onSubmit}
        pending={false}
        users={users}
      />,
    )
    fireEvent.change(screen.getByLabelText('form.clocked_in_at'), {
      target: { value: '2026-01-05T08:00' },
    })
    fireEvent.change(screen.getByLabelText('form.clocked_out_at'), {
      target: { value: '2026-01-05T09:00' },
    })
    fireEvent.change(screen.getByLabelText('form.note'), { target: { value: '  note  ' } })
    const submit = screen.getByRole('button', { name: 'create.submit' })
    await waitFor(() => {
      expect(submit).toBeEnabled()
    })
    await userEvent.click(submit)
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        clockedInAt: new Date('2026-01-05T08:00').getTime(),
        clockedOutAt: new Date('2026-01-05T09:00').getTime(),
        note: 'note',
        userId: 'u1',
      })
    })
  })

  it('prefills when editing', () => {
    render(
      <ClockForm
        defaultValues={{
          clockedInAt: '2026-01-05T08:00',
          clockedOutAt: '2026-01-05T09:00',
          note: 'prev',
          userId: 'u1',
        }}
        editing
        onSubmit={vi.fn()}
        pending={false}
        users={users}
      />,
    )
    expect(screen.getByLabelText('form.clocked_in_at')).toHaveValue('2026-01-05T08:00')
    expect(screen.getByLabelText('form.note')).toHaveValue('prev')
    expect(screen.getByRole('button', { name: 'edit.submit' })).toBeInTheDocument()
  })
})
