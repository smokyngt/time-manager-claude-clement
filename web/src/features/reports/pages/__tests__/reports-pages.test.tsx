import { screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TeamReportPage, UserReportPage } from '@/features/reports/pages'
import { TestAuth, TestQuery } from '@/test-support'

vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())

const sdk = vi.hoisted(() => ({
  reports: { team: vi.fn(), user: vi.fn() },
  teams: { retrieve: vi.fn() },
  users: { retrieve: vi.fn() },
}))

vi.mock('@/config/sdk', () => ({ sdk }))

vi.stubGlobal(
  'ResizeObserver',
  class {
    disconnect() {}
    observe() {}
    unobserve() {}
  },
)

const HOUR = 3_600_000

function userReport(workedMs: number) {
  return {
    report: {
      from: 1,
      granularity: 'day',
      kpis: {
        averageDailyMs: workedMs,
        daysWorked: workedMs === 0 ? 0 : 1,
        lateDays: 0,
        latenessRate: 0,
        overtimeMs: 0,
        targetMs: 0,
        workedMs,
      },
      object: 'user_report',
      series: [{ late: 0, periodStart: 1, workedMs }],
      to: 2,
      userId: 'u1',
    },
  }
}

function renderUser() {
  return TestAuth.render(
    <Routes>
      <Route element={<UserReportPage />} path="/reports/users/:userId" />
    </Routes>,
    { role: 'manager', route: '/reports/users/u1' },
  )
}

beforeEach(() => {
  TestQuery.reset()
  vi.clearAllMocks()
  sdk.users.retrieve.mockResolvedValue({
    user: TestAuth.user({ firstName: 'Ada', lastName: 'Lovelace' }),
  })
  sdk.teams.retrieve.mockResolvedValue({ team: { id: 't1', name: 'Core team' } })
})

describe('UserReportPage', () => {
  it('shows the skeleton while loading', () => {
    sdk.reports.user.mockReturnValue(new Promise(() => undefined))
    renderUser()
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })

  it('titles the page with the user name and renders the KPIs', async () => {
    sdk.reports.user.mockResolvedValue(userReport(8 * HOUR))
    renderUser()
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ada Lovelace' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('kpi.days.label')).toBeInTheDocument()
    expect(sdk.reports.user).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }))
  })

  it('shows the empty state without errors', async () => {
    sdk.reports.user.mockResolvedValue(userReport(0))
    renderUser()
    expect(await screen.findByText('user.empty_title')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the error state only', async () => {
    sdk.reports.user.mockRejectedValue(new Error('boom'))
    renderUser()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('user.empty_title')).not.toBeInTheDocument()
  })
})

describe('TeamReportPage', () => {
  function renderTeam() {
    return TestAuth.render(
      <Routes>
        <Route element={<TeamReportPage />} path="/teams/:teamId/dashboard" />
      </Routes>,
      { role: 'manager', route: '/teams/t1/dashboard' },
    )
  }

  it('titles the page with the team name and shows the empty state', async () => {
    sdk.reports.team.mockResolvedValue({
      report: {
        from: 1,
        granularity: 'day',
        kpis: {},
        members: [],
        series: [],
        teamId: 't1',
        to: 2,
      },
    })
    renderTeam()
    expect(await screen.findByRole('heading', { level: 1, name: 'Core team' })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('team.empty_title')).toBeInTheDocument()
    })
    expect(sdk.reports.team).toHaveBeenCalledWith(expect.objectContaining({ teamId: 't1' }))
  })

  it('shows the error state', async () => {
    sdk.reports.team.mockRejectedValue(new Error('boom'))
    renderTeam()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
