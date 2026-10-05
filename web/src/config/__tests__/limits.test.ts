import { describe, expect, it } from 'vitest'

import { LIMITS } from '@/config/limits'

describe('LIMITS', () => {
  it('mirrors the API schema bounds', () => {
    expect(LIMITS.name).toBe(100)
    expect(LIMITS.firstName).toBe(100)
    expect(LIMITS.description).toBe(500)
    expect(LIMITS.note).toBe(500)
    expect(LIMITS.email).toBe(254)
    expect(LIMITS.password).toEqual({ max: 128, min: 10 })
    expect(LIMITS.phone).toEqual({ max: 20, min: 6 })
    expect(LIMITS.weeklyHours).toEqual({ max: 80, min: 1 })
    expect(LIMITS.bulkIds).toBe(100)
    expect(LIMITS.pageSize).toEqual({ default: 25, max: 100 })
  })

  it('validates names, phones and times like the API patterns', () => {
    expect(LIMITS.patterns.name.test("Jean-Luc O'Neil")).toBe(true)
    expect(LIMITS.patterns.name.test('1abc')).toBe(false)
    expect(LIMITS.patterns.phone.test('+33 6 12 34 56 78')).toBe(true)
    expect(LIMITS.patterns.phone.test('abc')).toBe(false)
    expect(LIMITS.patterns.time.test('09:30')).toBe(true)
    expect(LIMITS.patterns.time.test('24:00')).toBe(false)
  })
})
