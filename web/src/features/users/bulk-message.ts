import type { BulkResult } from '@/features/users/types'

export function describeBulk(result: BulkResult, verb: string) {
  const done = result.succeeded.length
  const failed = result.failed.length
  const noun = done === 1 ? 'user' : 'users'
  if (failed === 0) return `${done} ${noun} ${verb}`
  return `${done} ${noun} ${verb}, ${failed} failed`
}
