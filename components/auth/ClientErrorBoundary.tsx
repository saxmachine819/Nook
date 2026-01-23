"use client"

import React from "react"

interface State {
  hasError: boolean
  error: Error | null
}

export class ClientErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ClientErrorBoundary] Caught error:", error, info)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div
          className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6"
          role="alert"
        >
          <h1 className="text-lg font-semibold text-foreground">
            Something went wrong
          </h1>
          <p className="max-w-md text-center text-sm text-muted-foreground">
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
