import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TeamFixtures } from '@/features/teams/__tests__/fixtures'
import { TeamForm } from '@/features/teams/components/team-form'

vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())

function setup(props: Partial<React.ComponentProps<typeof TeamForm>> = {}) {
  const onSubmit = vi.fn()
  const onCancel = vi.fn()
  render(
    <TeamForm
      canPickManager={false}
      defaultManagerId="manager-1"
      onCancel={onCancel}
      onSubmit={onSubmit}
      {...props}
    />,
  )
  return { onCancel, onSubmit }
}

const submit = () => screen.getByRole('button', { name: 'create.submit' })

describe('TeamForm', () => {
  it('disables submit until the name is valid', async () => {
    setup()
    expect(submit()).toBeDisabled()
    await userEvent.type(screen.getByLabelText('form.name'), 'Ops')
    await waitFor(() => {
      expect(submit()).toBeEnabled()
    })
  })

  it('submits trimmed values with the defaults', async () => {
    const { onSubmit } = setup()
    await userEvent.type(screen.getByLabelText('form.name'), '  Ops  ')
    await userEvent.type(screen.getByLabelText('form.description'), '  Night shift ')
    await waitFor(() => {
      expect(submit()).toBeEnabled()
    })
    await userEvent.click(submit())
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled()
    })
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      description: 'Night shift',
      managerId: 'manager-1',
      name: 'Ops',
      weeklyHoursTarget: 35,
      workEnd: '17:00',
      workStart: '09:00',
    })
  })

  it('flags a name over the limit and shows the counter', async () => {
    setup()
    const name = screen.getByLabelText('form.name')
    fireEvent.change(name, { target: { value: 'a'.repeat(101) } })
    expect(await screen.findByText('form.errors.name_max')).toHaveAttribute('role', 'alert')
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('101/100')).toBeInTheDocument()
    expect(submit()).toBeDisabled()
  })

  it('flags a description over the limit', async () => {
    setup()
    await userEvent.type(screen.getByLabelText('form.name'), 'Ops')
    fireEvent.change(screen.getByLabelText('form.description'), {
      target: { value: 'a'.repeat(501) },
    })
    expect(await screen.findByText('form.errors.description_max')).toBeInTheDocument()
    expect(submit()).toBeDisabled()
  })

  it('requires the end of the day to be after the start', async () => {
    setup()
    await userEvent.type(screen.getByLabelText('form.name'), 'Ops')
    fireEvent.change(screen.getByLabelText('form.work_end'), { target: { value: '08:00' } })
    expect(await screen.findByText('form.errors.end_after_start')).toBeInTheDocument()
    expect(submit()).toBeDisabled()
  })

  it.each(['0', '81'])('rejects %s weekly hours', async (hours) => {
    setup()
    await userEvent.type(screen.getByLabelText('form.name'), 'Ops')
    fireEvent.change(screen.getByLabelText('form.weekly_hours'), { target: { value: hours } })
    expect(await screen.findByText('form.errors.hours_range')).toBeInTheDocument()
    expect(submit()).toBeDisabled()
  })

  it('prefills the fields when editing', async () => {
    setup({ team: TeamFixtures.team({ workEnd: '18:00' }) })
    expect(screen.getByLabelText('form.name')).toHaveValue('Support')
    expect(screen.getByLabelText('form.description')).toHaveValue('Handles customer requests')
    expect(screen.getByLabelText('form.work_end')).toHaveValue('18:00')
    expect(screen.getByLabelText('form.weekly_hours')).toHaveValue(35)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'edit.submit' })).toBeEnabled()
    })
  })

  it('shows the manager picker only for admins', () => {
    const { unmount } = render(
      <TeamForm canPickManager defaultManagerId="a" onCancel={vi.fn()} onSubmit={vi.fn()} />,
    )
    expect(screen.getByText('form.manager')).toBeInTheDocument()
    unmount()
    setup()
    expect(screen.queryByText('form.manager')).not.toBeInTheDocument()
  })

  it('cancels', async () => {
    const { onCancel } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'common:actions.cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('disables submit while submitting', async () => {
    setup({ submitting: true, team: TeamFixtures.team() })
    expect(screen.getByRole('button', { name: 'edit.submit' })).toBeDisabled()
  })
})
