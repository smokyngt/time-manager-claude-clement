import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AuthLayout } from '@/components/layout/auth-layout'
import { CenteredLayout } from '@/components/layout/centered-layout'

describe('AuthLayout', () => {
  it('renders a main landmark with a single h1', () => {
    render(
      <AuthLayout description="Sign in" footer="Footer text" title="Welcome back">
        <button type="button">Go</button>
      </AuthLayout>,
    )
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByText('Footer text')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument()
  })
})

describe('CenteredLayout', () => {
  it('renders main and h1 when standalone', () => {
    render(<CenteredLayout description="Nothing here" title="Not found" />)
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Not found' })).toBeInTheDocument()
  })

  it('omits main when embedded in the app shell', () => {
    render(<CenteredLayout standalone={false} title="Denied" />)
    expect(screen.queryByRole('main')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })
})
