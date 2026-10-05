export class Initials {
  /**
   * @route client.lib.initials.of
   * @param {string} firstName
   * @param {string} lastName
   * @returns {string}
   */
  static of(firstName: string, lastName: string): string {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }
}
