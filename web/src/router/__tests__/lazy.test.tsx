import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Lazy, pick } from '@/router/lazy'

vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())

describe('pick', () => {
  it('maps a named export to a default export', () => {
    const Page = () => null
    expect(pick('Page')({ Page })).toEqual({ default: Page })
  })
})

describe('Lazy.element', () => {
  it('shows the skeleton then the page', async () => {
    const element = Lazy.element(() => Promise.resolve({ default: () => <p>loaded page</p> }))
    render(element)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(await screen.findByText('loaded page')).toBeInTheDocument()
  })

  it('loads the module once', async () => {
    const load = vi.fn(() => Promise.resolve({ default: () => <p>page</p> }))
    const element = Lazy.element(load)
    const first = render(element)
    await screen.findByText('page')
    first.unmount()
    render(element)
    await screen.findByText('page')
    expect(load).toHaveBeenCalledTimes(1)
  })
})
