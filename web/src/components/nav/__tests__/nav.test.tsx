import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { isNavActive } from '@/components/nav/is-nav-active'
import { SidebarNav } from '@/components/nav/sidebar-nav'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TestAuth } from '@/test-support/test-auth'

vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())

describe('isNavActive', () => {
  it('matches exactly when end is set', () => {
    expect(isNavActive({ end: true, to: '/' }, '/')).toBe(true)
    expect(isNavActive({ end: true, to: '/' }, '/teams')).toBe(false)
  })

  it('matches nested paths on segment boundaries', () => {
    expect(isNavActive({ to: '/teams' }, '/teams')).toBe(true)
    expect(isNavActive({ to: '/teams' }, '/teams/42/dashboard')).toBe(true)
    expect(isNavActive({ to: '/users' }, '/users-archive')).toBe(false)
  })
})

describe('SidebarNav', () => {
  function renderNav(role: 'employee' | 'manager', route = '/teams/1') {
    return TestAuth.render(
      <TooltipProvider>
        <SidebarNav />
      </TooltipProvider>,
      { role, route },
    )
  }

  it('hides the users entry without users:manage', () => {
    renderNav('employee')
    expect(screen.queryByRole('link', { name: 'users' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'teams' })).toBeInTheDocument()
  })

  it('shows the users entry for managers', () => {
    renderNav('manager')
    expect(screen.getByRole('link', { name: 'users' })).toBeInTheDocument()
  })
})
