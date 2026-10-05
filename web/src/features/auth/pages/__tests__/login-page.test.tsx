import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { LoginPage } from '@/features/auth/pages'
import { TestAuth } from '@/test-support'

vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())

const sdk = vi.hoisted(() => ({ auth: { login: vi.fn() } }))

vi.mock('@/config/sdk', () => ({ sdk }))

function Where() {
  const { pathname, search } = useLocation()
  return <p>{`at:${pathname}${search}`}</p>
}

function renderLogin(route: string, auth = {}) {
  return TestAuth.render(
    <Routes>
      <Route element={<LoginPage />} path="/login" />
      <Route element={<Where />} path="*" />
    </Routes>,
    { auth: { status: 'unauthenticated', user: null, ...auth }, route },
  )
}

describe('LoginPage', () => {
  it('navigates to the redirect parameter after login', async () => {
    const login = vi.fn(() => Promise.resolve())
    renderLogin('/login?redirect=%2Fteams%3Fq%3Dx', { login })
    await userEvent.type(screen.getByLabelText('form.email'), 'a@b.co')
    await userEvent.type(screen.getByLabelText('form.password'), 'secret-password')
    await userEvent.click(screen.getByRole('button', { name: 'form.submit' }))
    await waitFor(() => {
      expect(screen.getByText('at:/teams?q=x')).toBeInTheDocument()
    })
  })

  it('ignores unsafe redirect targets', async () => {
    renderLogin('/login?redirect=%2F%2Fevil.com')
    await userEvent.type(screen.getByLabelText('form.email'), 'a@b.co')
    await userEvent.type(screen.getByLabelText('form.password'), 'secret-password')
    await userEvent.click(screen.getByRole('button', { name: 'form.submit' }))
    await waitFor(() => {
      expect(screen.getByText('at:/')).toBeInTheDocument()
    })
  })

  it('starts the Microsoft flow with the sanitized redirect', async () => {
    const loginWithMicrosoft = vi.fn()
    renderLogin('/login?redirect=%2Freports', { loginWithMicrosoft })
    await userEvent.click(screen.getByRole('button', { name: 'login.microsoft' }))
    expect(loginWithMicrosoft).toHaveBeenCalledWith('/reports')
  })

  it('passes the root when the redirect is unsafe', async () => {
    const loginWithMicrosoft = vi.fn()
    renderLogin('/login?redirect=https%3A%2F%2Fevil.com', { loginWithMicrosoft })
    await userEvent.click(screen.getByRole('button', { name: 'login.microsoft' }))
    expect(loginWithMicrosoft).toHaveBeenCalledWith('/')
  })
})
