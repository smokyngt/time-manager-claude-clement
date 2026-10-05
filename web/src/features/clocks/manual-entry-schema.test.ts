import { describe, expect, it } from 'vitest'

import { manualEntrySchema } from '@/features/clocks/manual-entry-schema'

const base = { note: '', user_id: 'u1' }

function messages(clocked_in_at: string, clocked_out_at: string, note = '') {
  const result = manualEntrySchema.safeParse({ ...base, clocked_in_at, clocked_out_at, note })
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe('manualEntrySchema', () => {
  it('accepts a valid past entry', () => {
    expect(messages('2020-01-01T09:00', '2020-01-01T17:00')).toEqual([])
  })

  it('requires both timestamps', () => {
    expect(messages('', '')).toEqual(['Start is required', 'End is required'])
  })

  it('rejects an end before the start', () => {
    expect(messages('2020-01-01T17:00', '2020-01-01T09:00')).toContain('End must be after start')
  })

  it('rejects future timestamps', () => {
    expect(messages('2999-01-01T09:00', '2999-01-01T10:00')).toContain(
      'Start cannot be in the future',
    )
  })

  it('rejects entries longer than 24 hours', () => {
    expect(messages('2020-01-01T09:00', '2020-01-02T10:00')).toContain(
      'An entry cannot exceed 24 hours',
    )
  })

  it('rejects notes over 500 characters', () => {
    expect(messages('2020-01-01T09:00', '2020-01-01T10:00', 'x'.repeat(501))).toContain(
      'Note must be 500 characters or fewer',
    )
  })

  it('requires a user', () => {
    const result = manualEntrySchema.safeParse({
      clocked_in_at: '2020-01-01T09:00',
      clocked_out_at: '2020-01-01T10:00',
      note: '',
      user_id: '',
    })
    expect(result.success).toBe(false)
  })
})
