import { describe, expect, it } from 'vitest'

import { cn } from '@/lib/cn'

describe('cn', () => {
  it('merges and dedupes tailwind classes', () => {
    const hidden = Math.random() > 2
    expect(cn('px-2 py-1', hidden && 'hidden', 'px-4')).toBe('py-1 px-4')
  })
})
