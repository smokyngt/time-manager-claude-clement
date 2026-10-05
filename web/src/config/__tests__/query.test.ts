import { MutationObserver } from '@tanstack/react-query'
import { AuthenticationError, NetworkError, ServerError, TimeManagerError } from '@time-manager/sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ToastCapture } from '@/test-support/test-toast'

import { queryClient, QueryEvents, STALE_TIMES } from '@/config/query'
import { QueryKeys } from '@/config/query-keys'
import { TestQuery } from '@/test-support/test-query'
import { TestToast } from '@/test-support/test-toast'

const notFound = new TimeManagerError({ code: 'team.not.found', status: 404 })

describe('queryClient', () => {
  let toasts: ToastCapture

  beforeEach(() => {
    TestQuery.reset()
    toasts = TestToast.capture()
  })

  afterEach(() => {
    toasts.stop()
  })

  describe('retry rules', () => {
    const retry = queryClient.getDefaultOptions().queries?.retry as (
      count: number,
      error: unknown,
    ) => boolean
    const delay = queryClient.getDefaultOptions().queries?.retryDelay as (attempt: number) => number

    it('retries auth errors once', () => {
      const error = new AuthenticationError({ code: 'token.authentication.failed', status: 401 })
      expect(retry(0, error)).toBe(true)
      expect(retry(1, error)).toBe(false)
    })

    it('retries network and 5xx errors twice', () => {
      const server = new ServerError({ code: 'internal.unexpected', status: 500 })
      expect(retry(0, new NetworkError({}))).toBe(true)
      expect(retry(1, server)).toBe(true)
      expect(retry(2, server)).toBe(false)
    })

    it('never retries other client errors', () => {
      expect(retry(0, notFound)).toBe(false)
    })

    it('backs off exponentially up to 30 s', () => {
      expect([delay(0), delay(1), delay(2)]).toEqual([1000, 2000, 4000])
      expect(delay(10)).toBe(30_000)
    })

    it('never retries mutations', () => {
      expect(queryClient.getDefaultOptions().mutations?.retry).toBe(false)
    })
  })

  describe('staleTime defaults', () => {
    it('applies a staleTime per key family', () => {
      expect(queryClient.getQueryDefaults(QueryKeys.clocks()).staleTime).toBe(STALE_TIMES.clocks)
      expect(queryClient.getQueryDefaults(QueryKeys.team('1')).staleTime).toBe(STALE_TIMES.teams)
      expect(queryClient.getQueryDefaults(QueryKeys.me()).staleTime).toBe(STALE_TIMES.me)
      expect(queryClient.getQueryDefaults(['other']).staleTime).toBeUndefined()
      expect(queryClient.getDefaultOptions().queries?.staleTime).toBe(STALE_TIMES.default)
    })
  })

  describe('query errors', () => {
    it('toasts a failed query once with translated text', async () => {
      await queryClient
        .query({ queryFn: () => Promise.reject(notFound), queryKey: ['t1'], retry: false })
        .catch(() => undefined)
      expect(toasts.errors).toHaveLength(1)
      expect(toasts.errors[0]).toMatchObject({
        message: 'This team no longer exists.',
        source: 'query',
      })
    })

    it('honours meta.suppressError', async () => {
      await queryClient
        .query({
          meta: { suppressError: true },
          queryFn: () => Promise.reject(notFound),
          queryKey: ['t2'],
          retry: false,
        })
        .catch(() => undefined)
      expect(toasts.errors).toHaveLength(0)
    })

    it('does not toast auth errors', async () => {
      const error = new AuthenticationError({ code: 'token.authentication.failed', status: 401 })
      await queryClient
        .query({ queryFn: () => Promise.reject(error), queryKey: ['t3'], retry: false })
        .catch(() => undefined)
      expect(toasts.errors).toHaveLength(0)
    })
  })

  describe('mutations', () => {
    function mutate(options: Record<string, unknown>) {
      const observer = new MutationObserver(queryClient, options)
      return observer.mutate(undefined).catch(() => undefined)
    }

    it('toasts failures without onError', async () => {
      await mutate({ mutationFn: () => Promise.reject(notFound) })
      expect(toasts.errors).toHaveLength(1)
      expect(toasts.errors[0]?.source).toBe('mutation')
    })

    it('leaves failures to onError when provided', async () => {
      const onError = vi.fn()
      await mutate({ mutationFn: () => Promise.reject(notFound), onError })
      expect(onError).toHaveBeenCalledTimes(1)
      expect(toasts.errors).toHaveLength(0)
    })

    it('honours meta.suppressError', async () => {
      await mutate({ meta: { suppressError: true }, mutationFn: () => Promise.reject(notFound) })
      expect(toasts.errors).toHaveLength(0)
    })

    it('toasts a string success message', async () => {
      await mutate({ meta: { successMessage: 'Saved' }, mutationFn: () => Promise.resolve(1) })
      expect(toasts.successes).toEqual([{ message: 'Saved' }])
    })

    it('toasts a function success message with data and variables', async () => {
      const observer = new MutationObserver<{ name: string }, Error, { n: number }>(queryClient, {
        meta: {
          successMessage: (data: { name: string }, variables: { n: number }) =>
            `${data.name}-${String(variables.n)}`,
        },
        mutationFn: () => Promise.resolve({ name: 'Team' }),
      })
      await observer.mutate({ n: 2 })
      expect(toasts.successes).toEqual([{ message: 'Team-2' }])
    })

    it('stays silent without a success message', async () => {
      await mutate({ mutationFn: () => Promise.resolve(1) })
      expect(toasts.successes).toHaveLength(0)
    })
  })
})

describe('QueryEvents', () => {
  it('subscribes and unsubscribes', () => {
    const errors = vi.fn()
    const successes = vi.fn()
    const stopErrors = QueryEvents.errors(errors)
    const stopSuccess = QueryEvents.success(successes)
    QueryEvents.emitError({ error: 1, message: 'm', source: 'query' })
    QueryEvents.emitSuccess({ message: 'ok' })
    expect(errors).toHaveBeenCalledTimes(1)
    expect(successes).toHaveBeenCalledWith({ message: 'ok' })
    stopErrors()
    stopSuccess()
    QueryEvents.emitError({ error: 1, message: 'm', source: 'query' })
    expect(errors).toHaveBeenCalledTimes(1)
  })
})
