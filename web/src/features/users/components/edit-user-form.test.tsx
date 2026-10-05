import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Role, UserRecord } from '@/features/users/types'

import { EditUserForm } from '@/features/users/components/edit-user-form'

const target: UserRecord = {
  archived_at: null,
  created_at: 1767225600000,
  email: 'jane@example.com',
  first_name: 'Jane',
  id: 'target-id',
  last_name: 'Doe',
  object: 'user',
  phone_number: null,
  role: 'employee',
  updated_at: null,
}

function setup(actor: { id: string; role: Role }, user: UserRecord = target, onSubmit = vi.fn()) {
  render(
    <EditUserForm
      actor={actor}
      onCancel={vi.fn()}
      onSubmit={onSubmit}
      pending={false}
      user={user}
    />,
  )
  return onSubmit
}

describe('EditUserForm', () => {
  it('shows every field including role for an admin', () => {
    setup({ id: 'admin-id', role: 'admin' })
    expect(screen.getByLabelText('First name')).toBeInTheDocument()
    expect(screen.getByLabelText('Last name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Phone number')).toBeInTheDocument()
    expect(screen.getByLabelText('New password')).toBeInTheDocument()
    expect(screen.getByLabelText('Role')).toBeInTheDocument()
  })

  it('hides the role field for a manager editing an employee', () => {
    setup({ id: 'manager-id', role: 'manager' })
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('New password')).toBeInTheDocument()
    expect(screen.queryByLabelText('Role')).not.toBeInTheDocument()
  })

  it('hides email and role when editing yourself', () => {
    setup({ id: 'target-id', role: 'admin' })
    expect(screen.getByLabelText('First name')).toBeInTheDocument()
    expect(screen.getByLabelText('Phone number')).toBeInTheDocument()
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Role')).not.toBeInTheDocument()
  })

  it('rejects a short password and does not submit', async () => {
    const onSubmit = setup({ id: 'manager-id', role: 'manager' })
    await userEvent.type(screen.getByLabelText('New password'), 'short')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Password must be at least 12 characters')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits valid values', async () => {
    const onSubmit = setup({ id: 'manager-id', role: 'manager' })
    await userEvent.clear(screen.getByLabelText('First name'))
    await userEvent.type(screen.getByLabelText('First name'), 'Janet')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled()
    })
  })
})
