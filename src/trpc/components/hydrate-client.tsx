import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { Suspense } from 'react'

import { LoadingState } from '@/shared/components/states/loading-state'
import { HydrationErrorBoundary } from '@/trpc/components/hydration-error-boundary'
import { HydrationKeyRecorder } from '@/trpc/components/hydration-key-recorder'
import { getQueryClient } from '@/trpc/server'

interface Props {
  children: React.ReactNode
  /** Suspense fallback while Tier-1 children stream. Default: LoadingState. */
  fallback?: React.ReactNode
  /** Error UI. Default: ErrorState + retry wired to query-error reset. */
  errorFallback?: React.ReactNode
}

export function HydrateClient({ children, fallback, errorFallback }: Props) {
  const queryClient = getQueryClient()
  const state = dehydrate(queryClient)
  return (
    <HydrationBoundary state={state}>
      {/* eslint-disable-next-line node/prefer-global/process */}
      {process.env.NODE_ENV !== 'production' && (
        <HydrationKeyRecorder queryKeys={state.queries.map(q => q.queryKey as unknown[])} />
      )}
      <HydrationErrorBoundary fallback={errorFallback}>
        <Suspense fallback={fallback ?? <LoadingState title="Loading…" />}>
          {children}
        </Suspense>
      </HydrationErrorBoundary>
    </HydrationBoundary>
  )
}
