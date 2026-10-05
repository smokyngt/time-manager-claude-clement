export type PasswordStrength = {
  label: 'empty' | 'fair' | 'good' | 'strong' | 'weak'
  score: 0 | 1 | 2 | 3 | 4
}

export class PasswordMeter {
  /**
   * @route client.features.profile.lib.passwordMeter.strength
   * @param {string} password
   * @returns {PasswordStrength}
   */
  static strength(password: string): PasswordStrength {
    if (password.length === 0) {
      return { label: 'empty', score: 0 }
    }
    const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((rule) =>
      rule.test(password),
    ).length
    let points = classes
    if (password.length >= 12) {
      points += 1
    }
    if (password.length >= 16) {
      points += 1
    }
    if (password.length < 10) {
      points = Math.min(points, 2)
    }
    if (points <= 2) {
      return { label: 'weak', score: 1 }
    }
    if (points === 3) {
      return { label: 'fair', score: 2 }
    }
    if (points === 4) {
      return { label: 'good', score: 3 }
    }
    return { label: 'strong', score: 4 }
  }
}
