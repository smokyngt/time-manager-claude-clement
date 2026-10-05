import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ErrorBoundary } from '@/providers/error-boundary'

function Bomb({ explode }: { explode: boolean }) {
  if (explode) {
    throw new Error('internal secret detail')
  }
  return <p>fine</p>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children when nothing fails', () => {
    render(
      <ErrorBoundary>
        <Bomb explode={false} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('fine')).toBeInTheDocument()
  })

  it('renders a translated fallback without leaking the error', () => {
    render(
      <ErrorBoundary>
        <Bomb explode />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.queryByText(/internal secret detail/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload the page' })).toBeInTheDocument()
  })
})
