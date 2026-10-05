import { useEffect } from 'react'

export const APP_TITLE = 'Time Manager'

export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title
    document.title = title ? `${title} · ${APP_TITLE}` : APP_TITLE
    return () => {
      document.title = previous
    }
  }, [title])
}
