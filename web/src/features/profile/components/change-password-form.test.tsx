import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ChangePasswordForm } from '@/features/profile/components/change-password-form'
import { passwordStrength } from '@/features/profile/password-strength'
import { passwordSchema } from '@/features/profile/schemas'

describe('passwordSchema', () => {
  it('rejects short passwords', () => {
    expect(passwordSchema.safeParse({ confirm_password: 'short', new_password: 'short' }).success).toBe(false)
  })

  it('rejects mismatching confirmation', () => {
    const result = passwordSchema.safeParse({
      confirm_password: 'another-long-password',
      new_password: 'a-long-enough-password',
    })
    expect(result.success).toBe(false)
  })

  it('accepts matching long passwords', () => {
    const value = 'a-long-enough-password'
    expect(passwordSchema.safeParse({ confirm_password: value, new_password: value }).success).toBe(true)
  })
})

describe('passwordStrength', () => {
  it('grades passwords', () => {
    expect(passwordStrength('').label).toBe('Empty')
    expect(passwordStrength('abc').label).toBe('Weak')
    expect(passwordStrength('Abcdefgh1234!xyz').label).toBe('Strong')
  })
})

describe('ChangePasswordForm', () => {
  it('shows validation errors and does not submit', async () => {
    const onSubmit = vi.fn(() => Promise.resolve(true))
    render(<ChangePasswordForm onSubmit={onSubmit} pending={false} />)
    await userEvent.type(screen.getByLabelText('New password'), 'short')
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }))
    expect(await screen.findByText('Password must be at least 12 characters')).toBeInTheDocument()
    expect(screen.getByText('Confirm your new password')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows a strength hint while typing', async () => {
    render(<ChangePasswordForm onSubmit={vi.fn(() => Promise.resolve(true))} pending={false} />)
    await userEvent.type(screen.getByLabelText('New password'), 'abc')
    expect(screen.getByText('Password strength: Weak')).toBeInTheDocument()
  })

  it('flags mismatching confirmation', async () => {
    const onSubmit = vi.fn(() => Promise.resolve(true))
    render(<ChangePasswordForm onSubmit={onSubmit} pending={false} />)
    await userEvent.type(screen.getByLabelText('New password'), 'a-long-enough-password')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'different-long-password')
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }))
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits matching passwords', async () => {
    const onSubmit = vi.fn(() => Promise.resolve(true))
    render(<ChangePasswordForm onSubmit={onSubmit} pending={false} />)
    await userEvent.type(screen.getByLabelText('New password'), 'a-long-enough-password')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'a-long-enough-password')
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }))
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        confirm_password: 'a-long-enough-password',
        new_password: 'a-long-enough-password',
      })
    })
  })
})
