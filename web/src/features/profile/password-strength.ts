export interface PasswordStrength {
  label: 'Empty' | 'Fair' | 'Good' | 'Strong' | 'Weak'
  score: 0 | 1 | 2 | 3 | 4
}

export function passwordStrength(password: string): PasswordStrength {
  if (password.length === 0) return { label: 'Empty', score: 0 }
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((rule) =>
    rule.test(password),
  ).length
  let points = classes
  if (password.length >= 12) points += 1
  if (password.length >= 16) points += 1
  if (password.length < 12) points = Math.min(points, 2)
  if (points <= 2) return { label: 'Weak', score: 1 }
  if (points === 3) return { label: 'Fair', score: 2 }
  if (points === 4) return { label: 'Good', score: 3 }
  return { label: 'Strong', score: 4 }
}
