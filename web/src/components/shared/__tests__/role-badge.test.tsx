import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { RoleBadge } from '@/components/shared/role-badge'

vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())

describe('RoleBadge', () => {
  it.each(['admin', 'manager', 'employee'] as const)(
    'renders the %s label with its variant',
    (role) => {
      render(<RoleBadge role={role} />)
      const badge = screen.getByText(`roles.${role}`)
      expect(badge).toHaveClass(`bg-badge-${role}`)
    },
  )
})
