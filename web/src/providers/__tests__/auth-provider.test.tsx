import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { queryClient } from '@/config/query'
import { AuthProvider } from '@/providers/auth-provider'
import { useAuth } from '@/providers/use-auth'
import { useAuthStore } from '@/stores/auth'
import { TestAuth } from '@/test-support/test-auth'
import { TestQuery } from '@/test-support/test-query'

const sdk = vi.hoisted(() => ({
  auth: {
    login: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
    microsoftUrl: vi.fn(() => 'http://api/v1/auth/microsoft'),
    refresh: vi.fn(),
  },
}))

vi.mock('@/config/sdk', () => ({ sdk }))

const user = TestAuth.user()
const session = {
  accessToken: 'tok',
  expiresIn: 900,
  scopes: ['teams:read'],
  tokenType: 'Bearer',
  user,
}

function Probe() {
  const auth = useAuth()
  return (
    <div>
      <p>status:{auth.status}</p>
      <p>user:{auth.user?.firstName ?? 'none'}</p>
      <p>scopes:{auth.scopes.join(',')}</p>
      <button
        onClick={() => void auth.login({ email: 'a@b.co', password: 'secret-password' })}
        type="button"
      >
        login
      </button>
      <button onClick={() => void auth.logout()} type="button">
        logout
      </button>
      <button
        onClick={() => {
          auth.loginWithMicrosoft('/teams')
        }}
        type="button"
      >
        microsoft
      </button>
    </div>
  )
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    TestQuery.reset()
    useAuthStore.getState().clear()
    sdk.auth.refresh.mockResolvedValue(session)
    sdk.auth.me.mockResolvedValue({ scopes: session.scopes, user })
    sdk.auth.logout.mockResolvedValue(undefined)
  })

  it('boots through a silent refresh then me', async () => {
    renderProvider()
    expect(screen.getByText('status:loading')).toBeInTheDocument()
    expect(await screen.findByText('status:authenticated')).toBeInTheDocument()
    expect(screen.getByText('user:Jane')).toBeInTheDocument()
    expect(screen.getByText('scopes:teams:read')).toBeInTheDocument()
    expect(sdk.auth.refresh).toHaveBeenCalledTimes(1)
    expect(sdk.auth.me).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().accessToken).toBe('tok')
  })

  it('ends unauthenticated when the refresh fails', async () => {
    sdk.auth.refresh.mockRejectedValue(new Error('no cookie'))
    renderProvider()
    expect(await screen.findByText('status:unauthenticated')).toBeInTheDocument()
    expect(sdk.auth.me).not.toHaveBeenCalled()
  })

  it('logs in and stores the session', async () => {
    sdk.auth.refresh.mockRejectedValue(new Error('no cookie'))
    sdk.auth.login.mockResolvedValue({ ...session, accessToken: 'login-token' })
    renderProvider()
    await screen.findByText('status:unauthenticated')
    act(() => {
      screen.getByText('login').click()
    })
    expect(sdk.auth.login).toHaveBeenCalledWith({ email: 'a@b.co', password: 'secret-password' })
    expect(await screen.findByText('status:authenticated')).toBeInTheDocument()
    expect(useAuthStore.getState().accessToken).toBe('login-token')
  })

  it('logs out, clears the session and the query cache', async () => {
    renderProvider()
    await screen.findByText('status:authenticated')
    queryClient.setQueryData(['x'], 1)
    act(() => {
      screen.getByText('logout').click()
    })
    expect(sdk.auth.logout).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('status:unauthenticated')).toBeInTheDocument()
    expect(useAuthStore.getState().accessToken).toBeNull()
    await waitFor(() => {
      expect(queryClient.getQueryData(['x'])).toBeUndefined()
    })
  })

  it('clears the session even if the logout request fails', async () => {
    sdk.auth.logout.mockRejectedValue(new Error('offline'))
    renderProvider()
    await screen.findByText('status:authenticated')
    await act(async () => {
      screen.getByText('logout').click()
      await Promise.resolve()
    })
    expect(await screen.findByText('status:unauthenticated')).toBeInTheDocument()
  })

  it('reacts when the SDK drops the session (refresh failed mid-session)', async () => {
    renderProvider()
    await screen.findByText('status:authenticated')
    act(() => {
      useAuthStore.getState().clear()
    })
    expect(await screen.findByText('status:unauthenticated')).toBeInTheDocument()
  })

  it('starts the Microsoft flow and remembers the target', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { assign })
    renderProvider()
    await screen.findByText('status:authenticated')
    act(() => {
      screen.getByText('microsoft').click()
    })
    expect(assign).toHaveBeenCalledWith('http://api/v1/auth/microsoft')
    expect(sessionStorage.getItem('tm-auth-redirect')).toBe('/teams')
    vi.unstubAllGlobals()
  })
})

describe('useAuth', () => {
  it('throws outside AuthProvider', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<Probe />)).toThrow('useAuth must be used within AuthProvider')
    error.mockRestore()
  })
})
