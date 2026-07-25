'use client'

import { QueryErrorResetBoundary } from '@tanstack/react-query'
import { ErrorBoundary } from 'react-error-boundary'

import { HydrationErrorFallback } from '@/trpc/components/hydration-error-fallback'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function HydrationErrorBoundary({ children, fallback }: Props) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ resetErrorBoundary }) =>
            fallback ?? <HydrationErrorFallback onRetry={() => resetErrorBoundary()} />}
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  )
}
