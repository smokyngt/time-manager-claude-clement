import { screen, waitFor } from '@testing-library/react'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ChangePasswordForm } from '@/features/profile/components/change-password-form'
import { ProfileEditForm } from '@/features/profile/components/profile-edit-form'
import { PasswordMeter } from '@/features/profile/lib/password-strength'
import { TestQuery } from '@/test-support'

vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())

const defaults = { firstName: 'Jane', lastName: 'Doe', phoneNumber: '' }

describe('ProfileEditForm', () => {
  beforeEach(() => {
    TestQuery.reset()
  })

  it('disables submit until the form changes', async () => {
    render(<ProfileEditForm defaults={defaults} onSubmit={vi.fn()} pending={false} />)
    expect(screen.getByRole('button', { name: 'edit.save' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('edit.first_name'), 'x')
    expect(screen.getByRole('button', { name: 'edit.save' })).toBeEnabled()
  })

  it('flags invalid values and does not submit', async () => {
    const onSubmit = vi.fn()
    render(<ProfileEditForm defaults={defaults} onSubmit={onSubmit} pending={false} />)
    await userEvent.clear(screen.getByLabelText('edit.first_name'))
    await userEvent.type(screen.getByLabelText('edit.phone'), 'abc')
    await userEvent.click(screen.getByRole('button', { name: 'edit.save' }))
    expect(await screen.findByText('validation.name_required')).toBeInTheDocument()
    expect(screen.getByText('validation.phone_invalid')).toBeInTheDocument()
    expect(screen.getByLabelText('edit.first_name')).toHaveAttribute('aria-invalid', 'true')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits trimmed values', async () => {
    const onSubmit = vi.fn()
    render(<ProfileEditForm defaults={defaults} onSubmit={onSubmit} pending={false} />)
    await userEvent.clear(screen.getByLabelText('edit.first_name'))
    await userEvent.type(screen.getByLabelText('edit.first_name'), '  Janet  ')
    await userEvent.type(screen.getByLabelText('edit.phone'), '+33 6 12 34 56 78')
    await userEvent.click(screen.getByRole('button', { name: 'edit.save' }))
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        { firstName: 'Janet', lastName: 'Doe', phoneNumber: '+33 6 12 34 56 78' },
        expect.anything(),
      )
    })
  })
})

describe('ChangePasswordForm', () => {
  const long = 'a-long-enough-password'

  async function fill(current: string, next: string, confirm: string) {
    await userEvent.type(screen.getByLabelText('password.current'), current)
    await userEvent.type(screen.getByLabelText('password.new'), next)
    await userEvent.type(screen.getByLabelText('password.confirm'), confirm)
    await userEvent.click(screen.getByRole('button', { name: 'password.submit' }))
  }

  it('rejects short passwords', async () => {
    const onSubmit = vi.fn()
    render(<ChangePasswordForm onSubmit={onSubmit} pending={false} wrongPassword={false} />)
    await fill('current-password', 'short', 'short')
    expect(await screen.findByText('validation.password_min')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('flags a mismatching confirmation', async () => {
    const onSubmit = vi.fn()
    render(<ChangePasswordForm onSubmit={onSubmit} pending={false} wrongPassword={false} />)
    await fill('current-password', long, 'different-long-password')
    expect(await screen.findByText('validation.password_mismatch')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows the wrong current password inline', () => {
    render(<ChangePasswordForm onSubmit={vi.fn()} pending={false} wrongPassword />)
    expect(screen.getByText('user.password.invalid')).toBeInTheDocument()
    expect(screen.getByLabelText('password.current')).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows a strength hint while typing', async () => {
    render(<ChangePasswordForm onSubmit={vi.fn()} pending={false} wrongPassword={false} />)
    expect(screen.getByText('password.hint')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('password.new'), 'abc')
    expect(screen.getByText('password.strength')).toBeInTheDocument()
  })

  it('submits and resets on success', async () => {
    const onSubmit = vi.fn(() => Promise.resolve(true))
    render(<ChangePasswordForm onSubmit={onSubmit} pending={false} wrongPassword={false} />)
    await fill('current-password', long, long)
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        confirmPassword: long,
        currentPassword: 'current-password',
        newPassword: long,
      })
    })
    await waitFor(() => {
      expect(screen.getByLabelText('password.new')).toHaveValue('')
    })
  })
})

describe('PasswordMeter', () => {
  it('grades passwords', () => {
    expect(PasswordMeter.strength('').label).toBe('empty')
    expect(PasswordMeter.strength('abc').label).toBe('weak')
    expect(PasswordMeter.strength('Abcdefgh1234!xyz').label).toBe('strong')
  })
})
