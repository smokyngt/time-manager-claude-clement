import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { AccessDenied } from '@/components/shared/access-denied'
import { Announcer } from '@/components/shared/announcer'
import { AnnouncerRegion } from '@/components/shared/announcer-region'
import { BulkActionBar } from '@/components/shared/bulk-action-bar'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Empty } from '@/components/shared/empty'
import { ErrorState } from '@/components/shared/error-state'
import { ListToolbar } from '@/components/shared/list-toolbar'
import { PageHeader } from '@/components/shared/page-header'
import { Pagination } from '@/components/shared/pagination'
import { SearchInput } from '@/components/shared/search-input'

vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())
const translate = vi.hoisted(() => vi.fn(() => 'translated'))

vi.mock('@/lib/errors', () => ({ Errors: { translate } }))

describe('SearchInput', () => {
  it('reports changes and clears', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<SearchInput onChange={onChange} value="" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    await userEvent.type(screen.getByRole('searchbox'), 'a')
    expect(onChange).toHaveBeenCalledWith('a')
    rerender(<SearchInput onChange={onChange} value="abc" />)
    await userEvent.click(screen.getByRole('button', { name: 'search.clear' }))
    expect(onChange).toHaveBeenLastCalledWith('')
  })
})

describe('Pagination', () => {
  it('renders nothing for a single page', () => {
    const { container } = render(
      <Pagination
        hasNext={false}
        hasPrevious={false}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
        page={1}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('navigates and disables unavailable directions', async () => {
    const onNext = vi.fn()
    const onPrevious = vi.fn()
    render(
      <Pagination
        hasNext
        hasPrevious={false}
        onNext={onNext}
        onPrevious={onPrevious}
        page={1}
        pages={3}
        total={60}
      />,
    )
    expect(screen.getByRole('button', { name: 'pagination.previous' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'pagination.next' }))
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(screen.getByText('pagination.page')).toBeInTheDocument()
  })
})

describe('ConfirmDialog', () => {
  it('confirms and cancels', async () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <ConfirmDialog
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
        open
        title="Delete?"
        variant="destructive"
      />,
    )
    expect(screen.getByRole('dialog', { name: 'Delete?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'actions.confirm' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'actions.cancel' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('disables confirmation while loading', () => {
    render(
      <ConfirmDialog loading onConfirm={vi.fn()} onOpenChange={vi.fn()} open title="Delete?" />,
    )
    expect(screen.getByRole('button', { name: 'actions.confirm' })).toBeDisabled()
  })
})

describe('ErrorState', () => {
  it('translates the error and retries', async () => {
    const onRetry = vi.fn()
    render(<ErrorState error={new Error('x')} onRetry={onRetry} />)
    expect(translate).toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('translated')
    await userEvent.click(screen.getByRole('button', { name: 'error.retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('hides retry without a callback', () => {
    render(<ErrorState />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('Empty', () => {
  it('renders custom copy and an action', () => {
    render(<Empty action={<button type="button">add</button>} description="d" title="t" />)
    expect(screen.getByRole('status')).toHaveTextContent('t')
    expect(screen.getByRole('button', { name: 'add' })).toBeInTheDocument()
  })
})

describe('BulkActionBar', () => {
  it('is hidden without a selection', () => {
    const { container } = render(<BulkActionBar count={0} onClear={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the count, actions and clears', async () => {
    const onClear = vi.fn()
    render(
      <BulkActionBar count={2} onClear={onClear}>
        <button type="button">archive</button>
      </BulkActionBar>,
    )
    expect(screen.getByRole('region', { name: 'bulk.label' })).toHaveTextContent('bulk.selected')
    await userEvent.click(screen.getByRole('button', { name: 'bulk.clear' }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})

describe('ListToolbar', () => {
  it('toggles the view mode', async () => {
    const onViewModeChange = vi.fn()
    render(
      <ListToolbar onViewModeChange={onViewModeChange} search={<span>s</span>} viewMode="grid" />,
    )
    expect(screen.getByRole('button', { name: 'view_mode.grid' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await userEvent.click(screen.getByRole('button', { name: 'view_mode.list' }))
    expect(onViewModeChange).toHaveBeenCalledWith('list')
  })

  it('omits the toggle without a handler', () => {
    render(<ListToolbar search={<span>s</span>} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('PageHeader', () => {
  it('renders title, description and actions', () => {
    render(
      <PageHeader actions={<button type="button">go</button>} description="desc" title="Teams" />,
    )
    expect(screen.getByRole('heading', { name: 'Teams' })).toBeInTheDocument()
    expect(screen.getByText('desc')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'go' })).toBeInTheDocument()
  })
})

describe('Announcer', () => {
  it('announces messages in a polite live region', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
      callback()
      return 0
    })
    render(<AnnouncerRegion />)
    act(() => {
      Announcer.say('3 selected')
    })
    expect(screen.getByRole('status')).toHaveTextContent('3 selected')
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    vi.unstubAllGlobals()
  })
})

describe('AccessDenied', () => {
  it('explains and links home', () => {
    render(
      <MemoryRouter>
        <AccessDenied />
      </MemoryRouter>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('access_denied.title')
    expect(screen.getByRole('link', { name: 'access_denied.back' })).toHaveAttribute('href', '/')
  })
})
