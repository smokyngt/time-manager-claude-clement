import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SortableHeader } from '@/components/shared/sortable-header'

function renderHeader(props: Partial<Parameters<typeof SortableHeader>[0]> = {}) {
  const onSort = vi.fn()
  render(
    <table>
      <thead>
        <tr>
          <SortableHeader label="Name" onSort={onSort} {...props} />
        </tr>
      </thead>
    </table>,
  )
  return onSort
}

describe('SortableHeader', () => {
  it('is unsorted by default and calls onSort', async () => {
    const onSort = renderHeader()
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'none')
    await userEvent.click(screen.getByRole('button', { name: 'Name' }))
    expect(onSort).toHaveBeenCalledTimes(1)
  })

  it('exposes the sort direction', () => {
    renderHeader({ direction: 'desc', sorted: true })
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'descending')
  })

  it('exposes ascending order', () => {
    renderHeader({ direction: 'asc', sorted: true })
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'ascending')
  })
})
