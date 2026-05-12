'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

type Props = {
  children: ReactNode
  fallback?: ReactNode
}

type State = {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-3 max-w-md p-6">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
            <p className="font-medium text-foreground">Something went wrong</p>
            <p className="text-sm text-muted-foreground">
              {this.state.error?.message ?? 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
