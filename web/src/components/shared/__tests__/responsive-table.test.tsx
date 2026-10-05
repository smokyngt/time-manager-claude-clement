import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ResponsiveTableColumn } from '@/components/shared/responsive-table'

import { ResponsiveTable } from '@/components/shared/responsive-table'

type Row = { email: string; id: string; name: string }

const rows: Row[] = [{ email: 'a@b.c', id: '1', name: 'Alice' }]
const columns: ResponsiveTableColumn<Row>[] = [
  { cell: (row) => row.name, header: 'Name', id: 'name', primary: true },
  { cell: (row) => row.email, header: 'Email', id: 'email' },
]

function mockWide(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ addEventListener: vi.fn(), matches, removeEventListener: vi.fn() })),
  )
}

function renderTable() {
  render(
    <ResponsiveTable
      actions={() => <button type="button">more</button>}
      actionsLabel="Actions"
      caption="People"
      columns={columns}
      getRowKey={(row) => row.id}
      rows={rows}
    />,
  )
}

describe('ResponsiveTable', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders a table from md up', () => {
    mockWide(true)
    renderTable()
    expect(screen.getByRole('table', { name: 'People' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Email' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'more' })).toBeInTheDocument()
  })

  it('renders stacked cards below md', () => {
    mockWide(false)
    renderTable()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'People' })).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'more' })).toBeInTheDocument()
  })
})
