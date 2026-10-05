import { useRouteError } from 'react-router'

export function RouteError(): never {
  const error = useRouteError()
  throw error instanceof Error ? error : new Error('Route error')
}
