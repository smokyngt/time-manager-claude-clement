import type { ComponentProps } from 'react'

import { Toaster as Sonner } from 'sonner'

import { useTheme } from '@/lib/theme/use-theme'

export function Toaster(props: ComponentProps<typeof Sonner>) {
  const { theme } = useTheme()
  return <Sonner closeButton position="top-right" richColors theme={theme} {...props} />
}
