import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { KpiGrid } from '@/features/reports/components/kpi-grid'
import { TeamMembersTable } from '@/features/reports/components/team-members-table'
import { TestAuth } from '@/test-support'

vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())

const HOUR = 3_600_000
const FROM = new Date(2026, 9, 5).getTime()
const TO = new Date(2026, 9, 11, 23, 59, 59, 999).getTime()
const AFTER = TO + HOUR

const KPIS = {
  averageDailyMs: 7.2 * HOUR,
  daysWorked: 4,
  lateDays: 1,
  latenessRate: 0.25,
  overtimeMs: -3.5 * HOUR,
  targetMs: 32 * HOUR,
  workedMs: 28.5 * HOUR,
}

describe('KpiGrid', () => {
  it('renders formatted values', () => {
    render(<KpiGrid kpis={KPIS} now={AFTER} range={{ from: FROM, to: TO }} />)
    expect(screen.getByText('28h 30m')).toBeInTheDocument()
    expect(screen.getByText('7h 12m')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
  })

  it('renders negative overtime signed and destructive once the period is over', () => {
    render(<KpiGrid kpis={KPIS} now={AFTER} range={{ from: FROM, to: TO }} />)
    expect(screen.getByText('-3h 30m')).toHaveClass('text-destructive')
    expect(screen.getByText('kpi.overtime.under')).toBeInTheDocument()
  })

  it('renders overtime neutral while the period is running', () => {
    const now = new Date(2026, 9, 6, 12).getTime()
    render(
      <KpiGrid kpis={{ ...KPIS, workedMs: 8 * HOUR }} now={now} range={{ from: FROM, to: TO }} />,
    )
    const overtime = screen.getByText(/^-/)
    expect(overtime).not.toHaveClass('text-destructive')
  })

  it('renders positive overtime with a plus sign', () => {
    render(
      <KpiGrid
        kpis={{ ...KPIS, overtimeMs: 2 * HOUR }}
        now={AFTER}
        range={{ from: FROM, to: TO }}
      />,
    )
    expect(screen.getByText('+2h 00m')).toHaveClass('text-emerald-700')
  })
})

const MEMBERS = [
  {
    daysWorked: 3,
    firstName: 'Ada',
    lastName: 'Lovelace',
    lateDays: 0,
    overtimeMs: HOUR,
    userId: 'u1',
    workedMs: 10 * HOUR,
  },
  {
    daysWorked: 4,
    firstName: 'Bob',
    lastName: 'Ross',
    lateDays: 2,
    overtimeMs: -HOUR,
    userId: 'u2',
    workedMs: 20 * HOUR,
  },
]

describe('TeamMembersTable', () => {
  it('links members to their report when reports can be read', () => {
    TestAuth.render(<TeamMembersTable members={MEMBERS} />, { role: 'manager' })
    expect(screen.getByRole('link', { name: 'Bob Ross' })).toHaveAttribute(
      'href',
      '/reports/users/u2',
    )
  })

  it('renders plain names without the reports scope', () => {
    TestAuth.render(<TeamMembersTable members={MEMBERS} />, { scopes: ['teams:read'] })
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
  })

  it('sorts by worked time descending then toggles', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    TestAuth.render(<TeamMembersTable members={MEMBERS} />, { role: 'manager' })
    const names = () =>
      screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent?.slice(0, 3))
    expect(names()).toEqual(['Bob', 'Ada'])
    await userEvent.click(screen.getByRole('button', { name: 'members.worked' }))
    expect(names()).toEqual(['Ada', 'Bob'])
  })
})
