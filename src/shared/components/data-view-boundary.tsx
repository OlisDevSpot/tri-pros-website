'use client'

import { QueryErrorResetBoundary } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { DataViewPendingContext } from '@/shared/dal/client/lib/data-view-pending-context'
import { HydrationErrorFallback } from '@/trpc/components/hydration-error-fallback'

/**
 * Wraps one data view. Its loading state is the view itself with no rows (see `DataViewPendingContext`), so the swap
 * to the real rows moves nothing. A failed first read shows a retry; changing the URL (Back, another filter) also
 * clears it.
 */
export function DataViewBoundary({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams()
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          resetKeys={[searchParams.toString()]}
          fallbackRender={({ resetErrorBoundary }) => <HydrationErrorFallback variant="section" onRetry={resetErrorBoundary} />}
        >
          <Suspense
            fallback={(
              <DataViewPendingContext value={true}>
                <div className="contents" data-slot="data-view-pending">{children}</div>
              </DataViewPendingContext>
            )}
          >
            {children}
          </Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  )
}
