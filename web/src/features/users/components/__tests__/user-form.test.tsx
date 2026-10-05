import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { UserForm } from '@/features/users/components/user-form'
import { TestAuth } from '@/test-support'

vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())

const admin = { id: 'a', role: 'admin' } as const
const manager = { id: 'm', role: 'manager' } as const
const target = TestAuth.user({ id: 't', phoneNumber: '+33 1 23 45 67' })

function setup(props: Partial<React.ComponentProps<typeof UserForm>> = {}) {
  const onSubmit = vi.fn()
  render(<UserForm actor={admin} onCancel={vi.fn()} onSubmit={onSubmit} {...props} />)
  return onSubmit
}

describe('UserForm field visibility', () => {
  it('shows role and password for admins creating', () => {
    setup()
    expect(screen.getByLabelText('form.role')).toBeInTheDocument()
    expect(screen.getByLabelText('form.password_create')).toBeInTheDocument()
    expect(screen.getByLabelText('form.email')).toBeInTheDocument()
  })

  it('hides role for managers creating', () => {
    setup({ actor: manager })
    expect(screen.queryByLabelText('form.role')).not.toBeInTheDocument()
    expect(screen.getByLabelText('form.password_create')).toBeInTheDocument()
  })

  it('shows only names and phone when editing self', () => {
    setup({ actor: { id: target.id, role: 'employee' }, user: target })
    expect(screen.getByLabelText('form.first_name')).toBeInTheDocument()
    expect(screen.getByLabelText('form.phone')).toBeInTheDocument()
    expect(screen.queryByLabelText('form.email')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('form.role')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('form.password_edit')).not.toBeInTheDocument()
  })

  it('shows email and password but no role for managers editing employees', () => {
    setup({ actor: manager, user: target })
    expect(screen.getByLabelText('form.email')).toBeInTheDocument()
    expect(screen.getByLabelText('form.password_edit')).toBeInTheDocument()
    expect(screen.queryByLabelText('form.role')).not.toBeInTheDocument()
  })

  it('shows role for admins editing others', () => {
    setup({ user: target })
    expect(screen.getByLabelText('form.role')).toBeInTheDocument()
  })
})

describe('UserForm behaviour', () => {
  it('disables submit until valid, flags invalid fields and trims', async () => {
    const onSubmit = setup()
    const submit = screen.getByRole('button', { name: 'create.submit' })
    expect(submit).toBeDisabled()
    await userEvent.type(screen.getByLabelText('form.email'), 'nope')
    expect(screen.getByLabelText('form.email')).toHaveAttribute('aria-invalid', 'true')
    expect(await screen.findByRole('alert')).toHaveTextContent('form.errors.invalid_email')
    await userEvent.clear(screen.getByLabelText('form.email'))
    await userEvent.type(screen.getByLabelText('form.email'), 'a@b.co')
    await userEvent.type(screen.getByLabelText('form.first_name'), '  Ann ')
    await userEvent.type(screen.getByLabelText('form.last_name'), 'Lee')
    await waitFor(() => {
      expect(submit).toBeEnabled()
    })
    await userEvent.click(submit)
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled()
    })
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      email: 'a@b.co',
      firstName: 'Ann',
      lastName: 'Lee',
    })
  })

  it('rejects short passwords', async () => {
    setup()
    await userEvent.type(screen.getByLabelText('form.password_create'), 'short')
    expect(await screen.findByRole('alert')).toHaveTextContent('form.errors.password_length')
  })

  it('prefills when editing and enables submit after a change', async () => {
    setup({ user: target })
    expect(screen.getByLabelText('form.first_name')).toHaveValue(target.firstName)
    expect(screen.getByLabelText('form.phone')).toHaveValue('+33 1 23 45 67')
    const submit = screen.getByRole('button', { name: 'edit.submit' })
    expect(submit).toBeDisabled()
    await userEvent.type(screen.getByLabelText('form.first_name'), 'x')
    await waitFor(() => {
      expect(submit).toBeEnabled()
    })
  })

  it('shows the taken email error and disables while pending', () => {
    setup({ emailTaken: true, pending: true })
    expect(screen.getByRole('alert')).toHaveTextContent('form.errors.email_taken')
    expect(screen.getByRole('button', { name: 'create.submit' })).toBeDisabled()
  })
})
