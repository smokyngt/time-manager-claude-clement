import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { LoginForm } from '@/features/auth/components/login-form'
import { loginSchema } from '@/features/auth/login-schema'
import { renderWithAuth } from '@/test/render'

describe('loginSchema', () => {
  it('rejects invalid email and empty password', () => {
    const result = loginSchema.safeParse({ email: 'nope', password: '' })
    expect(result.success).toBe(false)
  })

  it('accepts valid credentials', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'secret' }).success).toBe(true)
  })
})

describe('LoginForm', () => {
  it('shows validation errors and does not submit', async () => {
    const login = vi.fn()
    renderWithAuth(<LoginForm onSuccess={vi.fn()} />, { login })

    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Email is required')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })

  it('shows an inline error when login fails', async () => {
    const login = vi.fn(() => Promise.reject(new Error('Invalid credentials')))
    renderWithAuth(<LoginForm onSuccess={vi.fn()} />, { login })

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials')
  })

  it('calls onSuccess after a successful login', async () => {
    const login = vi.fn(() => Promise.resolve())
    const onSuccess = vi.fn()
    renderWithAuth(<LoginForm onSuccess={onSuccess} />, { login })

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co')
    await userEvent.type(screen.getByLabelText('Password'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled()
    })
    expect(login).toHaveBeenCalledWith({ email: 'a@b.co', password: 'secret' })
  })
})
