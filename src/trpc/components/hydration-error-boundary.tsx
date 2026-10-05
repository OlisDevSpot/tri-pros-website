'use client'

import { QueryErrorResetBoundary } from '@tanstack/react-query'
import { ErrorBoundary } from 'react-error-boundary'

import { HydrationErrorFallback } from '@/trpc/components/hydration-error-fallback'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
  /** Size of the default retry fallback; ignored when `fallback` is given. */
  variant?: 'page' | 'section'
}

export function HydrationErrorBoundary({ children, fallback, variant }: Props) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ resetErrorBoundary }) =>
            fallback ?? <HydrationErrorFallback variant={variant} onRetry={() => resetErrorBoundary()} />}
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  )
}
