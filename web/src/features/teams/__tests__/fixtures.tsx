import type { Team, User } from '@time-manager/sdk'
import type { ReactNode } from 'react'

import { MemoryRouter } from 'react-router'

import type { ToastActions } from '@/providers/use-toast-actions'

import { TestAuth } from '@/test-support/test-auth'
import { TestQuery } from '@/test-support/test-query'
import { TestToast } from '@/test-support/test-toast'

export class TeamFixtures {
  /**
   * @route client.features.teams.teamFixtures.team
   * @param {Partial<Team>} overrides
   * @returns {Team}
   */
  static team(overrides: Partial<Team> = {}): Team {
    return {
      archivedAt: null,
      createdAt: 1_700_000_000_000,
      description: 'Handles customer requests',
      id: 'team-1',
      managerId: 'manager-1',
      memberCount: 3,
      name: 'Support',
      object: 'team',
      updatedAt: null,
      weeklyHoursTarget: 35,
      workEnd: '17:00',
      workStart: '09:00',
      ...overrides,
    }
  }

  /**
   * @route client.features.teams.teamFixtures.user
   * @param {Partial<User>} overrides
   * @returns {User}
   */
  static user(overrides: Partial<User> = {}): User {
    return TestAuth.user({ id: 'user-1', ...overrides })
  }

  /**
   * @route client.features.teams.teamFixtures.wrapper
   * @param {ToastActions} actions
   * @returns {(props: { children: ReactNode }) => ReactNode} Query client, toast actions and router.
   */
  static wrapper(actions: ToastActions = TestToast.actions()) {
    const Query = TestQuery.wrapper()
    const Toast = TestToast.wrapper(actions)
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <Query>
          <Toast>
            <MemoryRouter>{children}</MemoryRouter>
          </Toast>
        </Query>
      )
    }
  }
}
