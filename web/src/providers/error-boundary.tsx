import type { ReactNode } from 'react'

import { Component } from 'react'

import { Button } from '@/components/ui/button'
import { i18n } from '@/lib/i18n'

type Props = { children: ReactNode }

type State = { failed: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) {
      return this.props.children
    }
    return (
      <div className="grid min-h-dvh place-items-center p-4 text-center" role="alert">
        <div className="max-w-sm space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">{i18n.t('common:boundary.title')}</h1>
          <p className="text-muted-foreground">{i18n.t('common:boundary.description')}</p>
          <Button
            onClick={() => {
              window.location.reload()
            }}
          >
            {i18n.t('common:boundary.reload')}
          </Button>
        </div>
      </div>
    )
  }
}
