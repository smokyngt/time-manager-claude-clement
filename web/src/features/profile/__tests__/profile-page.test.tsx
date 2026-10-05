import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimeManagerError } from '@time-manager/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { queryClient } from '@/config/query'
import { QueryKeys } from '@/config/query-keys'
import { ProfilePage } from '@/features/profile/pages'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'
import { TestAuth, TestQuery } from '@/test-support'

vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())

const sdk = vi.hoisted(() => ({
  auth: { me: vi.fn() },
  users: { update: vi.fn() },
}))

vi.mock('@/config/sdk', () => ({ sdk }))

const user = TestAuth.user()

describe('ProfilePage', () => {
  beforeEach(() => {
    TestQuery.reset()
    vi.clearAllMocks()
    sdk.users.update.mockResolvedValue({ failed: [], success: true, updated: [user.id] })
    sdk.auth.me.mockResolvedValue({ scopes: [], user: { ...user, firstName: 'Janet' } })
    usePreferencesStore.setState({ theme: 'system' })
  })

  it('renders the account card', () => {
    TestAuth.render(<ProfilePage />)
    expect(screen.getByText('jane.doe@example.com', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText('roles.employee')).toBeInTheDocument()
  })

  it('updates the profile, invalidates me and refreshes the auth user', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    TestAuth.render(<ProfilePage />)
    const input = screen.getByLabelText('edit.first_name')
    await userEvent.clear(input)
    await userEvent.type(input, 'Janet')
    await userEvent.click(screen.getByRole('button', { name: 'edit.save' }))
    await waitFor(() => {
      expect(sdk.users.update).toHaveBeenCalledWith([user.id], {
        firstName: 'Janet',
        lastName: 'Doe',
        phoneNumber: null,
      })
    })
    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: QueryKeys.me() })
    })
    expect(useAuthStore.getState().user?.firstName).toBe('Janet')
  })

  it('sends the current password and shows a wrong password inline', async () => {
    sdk.users.update.mockRejectedValue(
      new TimeManagerError({ code: 'user.password.invalid', status: 403 }),
    )
    TestAuth.render(<ProfilePage />)
    await userEvent.type(screen.getByLabelText('password.current'), 'wrong-password-1')
    await userEvent.type(screen.getByLabelText('password.new'), 'a-long-enough-password')
    await userEvent.type(screen.getByLabelText('password.confirm'), 'a-long-enough-password')
    await userEvent.click(screen.getByRole('button', { name: 'password.submit' }))
    await waitFor(() => {
      expect(sdk.users.update).toHaveBeenCalledWith([user.id], {
        currentPassword: 'wrong-password-1',
        password: 'a-long-enough-password',
      })
    })
    expect(await screen.findByText('user.password.invalid')).toBeInTheDocument()
  })

  it('toggles the theme and language', async () => {
    TestAuth.render(<ProfilePage />)
    const dark = screen.getByRole('button', { name: 'preferences.themes.dark' })
    await userEvent.click(dark)
    expect(usePreferencesStore.getState().theme).toBe('dark')
    expect(dark).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'language.fr' }))
  })
})
