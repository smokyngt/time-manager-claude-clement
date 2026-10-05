import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

import { QueryKeys } from '@/config/query-keys'
import { Errors } from '@/lib/errors'

export type QueryErrorEvent = {
  error: unknown
  message: string
  source: 'mutation' | 'query'
}

export type QuerySuccessEvent = {
  message: string
}

type SuccessMessage = (data: never, variables: never) => string

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      successMessage?: string | SuccessMessage
      suppressError?: boolean
    }
    queryMeta: {
      suppressError?: boolean
    }
  }
}

const errorListeners = new Set<(event: QueryErrorEvent) => void>()
const successListeners = new Set<(event: QuerySuccessEvent) => void>()

export class QueryEvents {
  /**
   * @route client.config.query.events.clear
   * @returns {void}
   */
  static clear(): void {
    errorListeners.clear()
    successListeners.clear()
  }

  /**
   * @route client.config.query.events.emitError
   * @param {QueryErrorEvent} event
   * @returns {void}
   */
  static emitError(event: QueryErrorEvent): void {
    errorListeners.forEach((listener) => {
      listener(event)
    })
  }

  /**
   * @route client.config.query.events.emitSuccess
   * @param {QuerySuccessEvent} event
   * @returns {void}
   */
  static emitSuccess(event: QuerySuccessEvent): void {
    successListeners.forEach((listener) => {
      listener(event)
    })
  }

  /**
   * @route client.config.query.events.errors
   * @param {(event: QueryErrorEvent) => void} callback
   * @returns {() => void} Unsubscribe.
   */
  static errors(callback: (event: QueryErrorEvent) => void): () => void {
    errorListeners.add(callback)
    return () => {
      errorListeners.delete(callback)
    }
  }

  /**
   * @route client.config.query.events.success
   * @param {(event: QuerySuccessEvent) => void} callback
   * @returns {() => void} Unsubscribe.
   */
  static success(callback: (event: QuerySuccessEvent) => void): () => void {
    successListeners.add(callback)
    return () => {
      successListeners.delete(callback)
    }
  }
}

export const STALE_TIMES = {
  clocks: 15_000,
  default: 30_000,
  me: 300_000,
  reports: 60_000,
  teams: 60_000,
  users: 60_000,
} as const

const MAX_RETRIES = 2
const MAX_BACKOFF_MS = 30_000

function retryQuery(failureCount: number, error: unknown): boolean {
  if (Errors.isAuth(error)) {
    return failureCount < 1
  }
  if (Errors.retryable(error)) {
    return failureCount < MAX_RETRIES
  }
  return false
}

function retryDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS)
}

function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: {
        refetchOnWindowFocus: false,
        retry: retryQuery,
        retryDelay,
        staleTime: STALE_TIMES.default,
      },
    },
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.options.onError !== undefined || mutation.meta?.suppressError === true) {
          return
        }
        QueryEvents.emitError({ error, message: Errors.translate(error), source: 'mutation' })
      },
      onSuccess: (data, variables, _context, mutation) => {
        const message = mutation.meta?.successMessage
        if (message === undefined) {
          return
        }
        const resolved =
          typeof message === 'function'
            ? (message as (data: unknown, variables: unknown) => string)(data, variables)
            : message
        QueryEvents.emitSuccess({ message: resolved })
      },
    }),
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.meta?.suppressError === true || Errors.isAuth(error)) {
          return
        }
        QueryEvents.emitError({ error, message: Errors.translate(error), source: 'query' })
      },
    }),
  })

  client.setQueryDefaults(QueryKeys.me(), { staleTime: STALE_TIMES.me })
  client.setQueryDefaults(QueryKeys.usersAll(), { staleTime: STALE_TIMES.users })
  client.setQueryDefaults(QueryKeys.teamsAll(), { staleTime: STALE_TIMES.teams })
  client.setQueryDefaults(QueryKeys.clocksAll(), { staleTime: STALE_TIMES.clocks })
  client.setQueryDefaults(QueryKeys.reportsAll(), { staleTime: STALE_TIMES.reports })

  return client
}

export const queryClient = createQueryClient()
