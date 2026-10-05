import type { ReactNode } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { queryClient } from '@/config/query'
import { QueryEvents } from '@/config/query'

export class TestQuery {
  /**
   * @route client.testSupport.testQuery.isolated
   * @returns {QueryClient} A fresh client without retries or caching.
   */
  static isolated(): QueryClient {
    return new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { gcTime: 0, retry: false } },
    })
  }

  /**
   * @route client.testSupport.testQuery.reset
   * @returns {void} Clears the real client and every QueryEvents listener.
   */
  static reset(): void {
    queryClient.clear()
    QueryEvents.clear()
  }

  /**
   * @route client.testSupport.testQuery.wrapper
   * @param {QueryClient} client Defaults to the real `queryClient`.
   * @returns {(props: { children: ReactNode }) => ReactNode}
   */
  static wrapper(client: QueryClient = queryClient) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }
  }
}
