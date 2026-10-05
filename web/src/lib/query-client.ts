import { QueryClient } from '@tanstack/react-query'

import { ApiError } from '@/lib/api/errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failure_count, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
        failure_count < 2,
      staleTime: 30_000,
    },
  },
})
