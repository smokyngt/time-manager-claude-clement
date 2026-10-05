import { describe, expect, it } from 'vitest'

import { LANGUAGES, NAMESPACES, resources } from '@/lib/i18n'

function flatten(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) {
    return [prefix]
  }
  return Object.entries(value).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  )
}

function placeholders(text: string) {
  return [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1]).sort()
}

function leaf(tree: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], tree)
}

describe('locale parity', () => {
  it('registers every namespace in every language', () => {
    LANGUAGES.forEach((language) => {
      expect(Object.keys(resources[language]).sort()).toEqual([...NAMESPACES].sort())
    })
  })

  describe.each(NAMESPACES)('%s', (namespace) => {
    const en = resources.en[namespace]
    const fr = resources.fr[namespace]

    it('has the same keys in en and fr', () => {
      expect(flatten(fr).sort()).toEqual(flatten(en).sort())
    })

    it('uses the same interpolation variables in en and fr', () => {
      flatten(en)
        .filter((key) => key !== '')
        .forEach((key) => {
          const english = leaf(en, key)
          const french = leaf(fr, key)
          expect(typeof english).toBe('string')
          expect(placeholders(String(french))).toEqual(placeholders(String(english)))
        })
    })

    it('has no empty text', () => {
      flatten(en)
        .filter((key) => key !== '')
        .forEach((key) => {
          expect(String(leaf(en, key)).trim()).not.toBe('')
          expect(String(leaf(fr, key)).trim()).not.toBe('')
        })
    })
  })
})
