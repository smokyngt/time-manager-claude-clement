import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { OfflineBanner } from './offline-banner'

describe('OfflineBanner', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renders an empty live region when online', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    render(<OfflineBanner />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('announces when offline', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    render(<OfflineBanner />)
    expect(screen.getByRole('status')).toHaveTextContent(/you are offline/i)
    act(() => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })
})
