import { describe, expect, it } from 'vitest'

import { LANGUAGES, NAMESPACES, resources } from '@/lib/i18n'

const SEGMENT = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/

function flatten(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) {
    return [prefix]
  }
  return Object.entries(value).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  )
}

describe.each(LANGUAGES)('locale keys (%s)', (language) => {
  describe.each(NAMESPACES)('%s', (namespace) => {
    const keys = flatten(resources[language][namespace]).filter((key) => key !== '')

    it('uses lowercase snake_case segments', () => {
      keys.forEach((key) => {
        key.split('.').forEach((segment) => {
          expect(segment, key).toMatch(SEGMENT)
        })
      })
    })

    it('ships plurals as _one and _other pairs', () => {
      const bases = new Set<string>()
      keys.forEach((key) => {
        const match = /^(.*)_(one|other)$/.exec(key)
        if (match?.[1]) {
          bases.add(match[1])
        }
      })
      bases.forEach((base) => {
        expect(keys, `${base}_one`).toContain(`${base}_one`)
        expect(keys, `${base}_other`).toContain(`${base}_other`)
      })
    })
  })
})
