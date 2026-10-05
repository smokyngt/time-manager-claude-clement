import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { clockSchema } from '@/features/clocks/lib/clock-schema'
import { TestClock } from '@/test-support'

const base = {
  clockedInAt: '2026-01-05T08:00',
  clockedOutAt: '2026-01-05T09:00',
  note: '',
  userId: 'u1',
}

function messages(values: Partial<typeof base>) {
  const result = clockSchema.safeParse({ ...base, ...values })
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe('clockSchema', () => {
  beforeEach(() => {
    TestClock.install('2026-01-05T12:00:00')
  })

  afterEach(() => {
    TestClock.restore()
  })

  it('accepts a valid entry', () => {
    expect(messages({})).toEqual([])
  })

  it('requires both times and a user', () => {
    expect(messages({ clockedInAt: '', clockedOutAt: '', userId: '' })).toEqual([
      'form.errors.in_required',
      'form.errors.out_required',
      'form.errors.user_required',
    ])
  })

  it('requires out after in', () => {
    expect(messages({ clockedOutAt: '2026-01-05T08:00' })).toEqual(['form.errors.out_before_in'])
  })

  it('rejects future times', () => {
    expect(messages({ clockedInAt: '2026-01-05T13:00', clockedOutAt: '2026-01-05T14:00' })).toEqual(
      ['form.errors.in_future', 'form.errors.out_future'],
    )
  })

  it('rejects entries longer than 24 hours', () => {
    expect(messages({ clockedInAt: '2026-01-03T08:00', clockedOutAt: '2026-01-04T09:00' })).toEqual(
      ['form.errors.too_long'],
    )
  })

  it('limits the note to 500 characters after trimming', () => {
    expect(messages({ note: ` ${'a'.repeat(500)} ` })).toEqual([])
    expect(messages({ note: 'a'.repeat(501) })).toEqual(['form.errors.note_too_long'])
  })
})
