import { describe, expect, it } from 'vitest'

import { LIMITS } from '@/config/limits'
import { createLoginSchema } from '@/features/auth/lib/login-schema'

const schema = createLoginSchema(((key: string) => key) as never)

function messages(input: { email: string; password: string }) {
  const result = schema.safeParse(input)
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe('createLoginSchema', () => {
  it('accepts valid credentials and trims the email', () => {
    const result = schema.safeParse({ email: '  a@b.co ', password: 'secret' })
    expect(result.success && result.data.email).toBe('a@b.co')
  })

  it('requires both fields', () => {
    expect(messages({ email: '', password: '' })).toEqual([
      'validation.email_required',
      'validation.password_required',
    ])
  })

  it('rejects an invalid email', () => {
    expect(messages({ email: 'nope', password: 'x' })).toEqual(['validation.email_invalid'])
  })

  it('enforces the shared limits', () => {
    const email = `${'a'.repeat(LIMITS.email)}@b.co`
    const password = 'p'.repeat(LIMITS.password.max + 1)
    expect(messages({ email, password })).toContain('validation.password_too_long')
    expect(messages({ email, password: 'x' })).toContain('validation.email_too_long')
  })
})
