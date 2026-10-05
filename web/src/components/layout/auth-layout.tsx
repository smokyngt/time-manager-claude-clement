import type { ReactNode } from 'react'

import { Logo } from '@/components/layout/logo'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'

export type AuthLayoutProps = {
  children: ReactNode
  description?: string
  footer?: ReactNode
  title: string
}

export function AuthLayout({ children, description, footer, title }: AuthLayoutProps) {
  return (
    <main className="grid min-h-dvh place-items-center bg-muted/40 p-4" id="main">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>
        <Card>
          <CardHeader className="text-center">
            <h1 className="text-xl leading-none font-semibold">{title}</h1>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </CardHeader>
          <CardContent className="space-y-5">{children}</CardContent>
        </Card>
        {footer ? <div className="text-center text-xs text-muted-foreground">{footer}</div> : null}
      </div>
    </main>
  )
}
