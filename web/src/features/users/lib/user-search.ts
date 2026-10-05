import type { User } from '@time-manager/sdk'

export class UserSearch {
  /**
   * @route client.features.users.userSearch.filter
   * @param {readonly User[]} users Loaded page.
   * @param {string} query
   * @returns {User[]} Users whose name or email contains every term of the query.
   */
  static filter(users: readonly User[], query: string): User[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (terms.length === 0) {
      return [...users]
    }
    return users.filter((user) => {
      const haystack = `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase()
      return terms.every((term) => haystack.includes(term))
    })
  }

  /**
   * @route client.features.users.userSearch.initials
   * @param {User} user
   * @returns {string}
   */
  static initials(user: Pick<User, 'firstName' | 'lastName'>): string {
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
  }

  /**
   * @route client.features.users.userSearch.name
   * @param {User} user
   * @returns {string}
   */
  static name(user: Pick<User, 'firstName' | 'lastName'>): string {
    return `${user.firstName} ${user.lastName}`
  }
}
