import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { NotFoundPage } from '@/features/errors/pages'
import { TestAuth } from '@/test-support'

vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())

describe('NotFoundPage', () => {
  it('explains and links home', () => {
    TestAuth.render(<NotFoundPage />, { route: '/nope' })
    expect(screen.getByText('not_found.description')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'not_found.back' })).toHaveAttribute('href', '/')
  })
})
