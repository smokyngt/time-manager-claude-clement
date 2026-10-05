import { ErrorCodes } from '@time-manager/sdk'
import { describe, expect, it } from 'vitest'

import { LANGUAGES, resources } from '@/lib/i18n'

function leaf(tree: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => {
    return typeof node === 'object' && node !== null
      ? (node as Record<string, unknown>)[key]
      : undefined
  }, tree)
}

describe.each(LANGUAGES)('errors.json (%s)', (language) => {
  it.each(Object.values(ErrorCodes))('translates %s', (code) => {
    expect(typeof leaf(resources[language].errors, code)).toBe('string')
  })

  it.each(['generic', 'network', 'timeout', 'rate_limited'])('has the %s fallback', (key) => {
    expect(typeof leaf(resources[language].errors, key)).toBe('string')
  })

  it('shows the seconds in rate_limited', () => {
    expect(resources[language].errors.rate_limited).toContain('{{seconds}}')
  })
})
