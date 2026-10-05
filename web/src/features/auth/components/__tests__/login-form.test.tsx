import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthenticationError, NetworkError, RateLimitError } from '@time-manager/sdk'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { LoginForm } from '@/features/auth/components/login-form'
import { i18n } from '@/lib/i18n'
import { TestAuth } from '@/test-support'

vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())

const sdk = vi.hoisted(() => ({ auth: { login: vi.fn() } }))

vi.mock('@/config/sdk', () => ({ sdk }))

async function fill(password = 'secret-password') {
  await userEvent.type(screen.getByLabelText('form.email'), 'a@b.co')
  await userEvent.type(screen.getByLabelText('form.password'), password)
  await userEvent.click(screen.getByRole('button', { name: 'form.submit' }))
}

function setup(login = vi.fn(() => Promise.resolve()), onSuccess = vi.fn()) {
  TestAuth.render(<LoginForm onSuccess={onSuccess} />, { auth: { login } })
  return { login, onSuccess }
}

describe('LoginForm', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en')
  })

  it('shows validation errors and does not submit', async () => {
    const { login } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'form.submit' }))
    expect(await screen.findByText('validation.email_required')).toBeInTheDocument()
    expect(screen.getByText('validation.password_required')).toBeInTheDocument()
    expect(screen.getByLabelText('form.email')).toHaveAttribute('aria-invalid', 'true')
    expect(login).not.toHaveBeenCalled()
  })

  it('rejects an invalid email', async () => {
    const { login } = setup()
    await userEvent.type(screen.getByLabelText('form.email'), 'nope')
    await userEvent.type(screen.getByLabelText('form.password'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'form.submit' }))
    expect(await screen.findByText('validation.email_invalid')).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })

  it('logs in and calls onSuccess', async () => {
    const { login, onSuccess } = setup()
    await fill()
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled()
    })
    expect(login).toHaveBeenCalledWith({ email: 'a@b.co', password: 'secret-password' })
  })

  it('shows the credentials error on 401', async () => {
    const login = vi.fn(() =>
      Promise.reject(new AuthenticationError({ code: 'auth.invalid.credentials', status: 401 })),
    )
    const { onSuccess } = setup(login)
    await fill()
    expect(await screen.findByText('The email or password is incorrect.')).toBeInTheDocument()
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('shows the retry delay in seconds on 429', async () => {
    const login = vi.fn(() =>
      Promise.reject(new RateLimitError({ code: 'rate.limited', retryAfter: 42, status: 429 })),
    )
    setup(login)
    await fill()
    expect(await screen.findByText('Too many requests. Try again in 42 seconds.')).toBeVisible()
  })

  it('shows the network error', async () => {
    const login = vi.fn(() => Promise.reject(new NetworkError({})))
    setup(login)
    await fill()
    expect(await screen.findByText(i18n.t('errors:network'))).toBeVisible()
  })

  it('toggles password visibility', async () => {
    setup()
    const password = screen.getByLabelText('form.password')
    expect(password).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: 'form.show_password' }))
    expect(password).toHaveAttribute('type', 'text')
  })
})
