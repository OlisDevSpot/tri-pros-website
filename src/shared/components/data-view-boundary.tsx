'use client'

import { QueryErrorResetBoundary } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { DataViewPending } from '@/shared/components/data-view-pending'
import { DataViewPendingContext } from '@/shared/dal/client/lib/data-view-pending-context'
import { HydrationErrorFallback } from '@/trpc/components/hydration-error-fallback'

/**
 * Wraps one data view. Its loading state is the view itself with no rows (see `DataViewPendingContext`), so the swap
 * to the real rows moves nothing. A failed read shows a retry above that same row-less view, so the toolbar stays live:
 * a key that keeps failing is escaped by changing a filter, which changes the URL and clears the error.
 */
export function DataViewBoundary({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams()
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          resetKeys={[searchParams.toString()]}
          fallbackRender={({ resetErrorBoundary }) => (
            <>
              <HydrationErrorFallback variant="section" onRetry={resetErrorBoundary} />
              <DataViewPendingContext value={true}>
                <div className="contents" data-slot="data-view-error">{children}</div>
              </DataViewPendingContext>
            </>
          )}
        >
          <Suspense fallback={<DataViewPending>{children}</DataViewPending>}>
            {children}
          </Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  )
}
