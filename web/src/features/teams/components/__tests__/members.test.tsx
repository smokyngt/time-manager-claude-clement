import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TeamFixtures } from '@/features/teams/__tests__/fixtures'
import { AddMembersDialog } from '@/features/teams/components/add-members-dialog'
import { MembersTable } from '@/features/teams/components/members-table'

vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())

const ada = TeamFixtures.user({ email: 'ada@example.com', firstName: 'Ada', id: 'ada', lastName: 'Lovelace' })
const bob = TeamFixtures.user({ email: 'bob@example.com', firstName: 'Bob', id: 'bob', lastName: 'Stone' })
const cleo = TeamFixtures.user({ email: 'cleo@example.com', firstName: 'Cleo', id: 'cleo', lastName: 'Ray' })

function renderDialog(props: Partial<React.ComponentProps<typeof AddMembersDialog>> = {}) {
  const onSubmit = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <AddMembersDialog
      candidates={[ada, bob, cleo]}
      memberIds={new Set(['cleo'])}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      open
      {...props}
    />,
  )
  return { onOpenChange, onSubmit }
}

describe('AddMembersDialog', () => {
  it('lists the candidates that are not members yet', () => {
    renderDialog()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Bob Stone')).toBeInTheDocument()
    expect(screen.queryByText('Cleo Ray')).not.toBeInTheDocument()
  })

  it('filters by name or email', async () => {
    renderDialog()
    await userEvent.type(screen.getByRole('searchbox'), 'bob@')
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument()
    expect(screen.getByText('Bob Stone')).toBeInTheDocument()
  })

  it('shows a message when nobody matches', async () => {
    renderDialog()
    await userEvent.type(screen.getByRole('searchbox'), 'zzz')
    expect(screen.getByText('members.add.none')).toBeInTheDocument()
  })

  it('submits the selected users', async () => {
    const { onSubmit } = renderDialog()
    const submit = screen.getByRole('button', { name: 'members.add.submit' })
    expect(submit).toBeDisabled()
    await userEvent.click(screen.getAllByRole('checkbox')[0]!)
    await userEvent.click(screen.getAllByRole('checkbox')[1]!)
    await userEvent.click(submit)
    expect(onSubmit).toHaveBeenCalledWith(['ada', 'bob'])
  })

  it('unselects a user', async () => {
    const { onSubmit } = renderDialog()
    const [first, second] = screen.getAllByRole('checkbox')
    await userEvent.click(first!)
    await userEvent.click(second!)
    await userEvent.click(first!)
    await userEvent.click(screen.getByRole('button', { name: 'members.add.submit' }))
    expect(onSubmit).toHaveBeenCalledWith(['bob'])
  })

  it('shows skeletons while loading', () => {
    renderDialog({ candidates: [], loading: true })
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })

  it('shows the error with a retry', async () => {
    const onRetry = vi.fn()
    renderDialog({ candidates: [], isError: true, onRetry })
    await userEvent.click(screen.getByRole('button', { name: 'common:error.retry' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('disables submit while submitting', async () => {
    renderDialog({ submitting: true })
    await userEvent.click(screen.getAllByRole('checkbox')[0]!)
    expect(screen.getByRole('button', { name: 'members.add.submit' })).toBeDisabled()
  })
})

describe('MembersTable', () => {
  it('renders skeletons while loading', () => {
    render(<MembersTable loading members={[]} />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })

  it('renders the empty state', () => {
    render(<MembersTable members={[]} />)
    expect(screen.getByText('members.empty_title')).toBeInTheDocument()
    expect(screen.getByText('members.empty')).toBeInTheDocument()
  })

  it('hides the remove action without a callback', () => {
    render(<MembersTable members={[ada]} />)
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('removes a member', async () => {
    const onRemove = vi.fn()
    render(<MembersTable members={[ada, bob]} onRemove={onRemove} />)
    const row = screen.getByText('Bob Stone').closest('tr')!
    await userEvent.click(within(row).getByRole('button'))
    expect(onRemove).toHaveBeenCalledWith(bob)
  })
})
