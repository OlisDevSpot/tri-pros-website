'use client'

import { useEffect } from 'react'

import { useIsDataViewPending } from '@/shared/dal/client/hooks/use-is-data-view-pending'
import { checkHydrationParity } from '@/shared/lib/hydration-drift'

/**
 * Dev-only: call with the exact queryOptions.queryKey a suspense view mounts,
 * to detect server-prefetch drift (see hydration-drift.ts). No-op in prod, and for a read the view skips (no key).
 */
export function useHydrationParityCheck(queryKey: readonly unknown[] | undefined): void {
  // A pending view draws before its route's server render arrives, so the recorded keys are the previous page's.
  const isPendingView = useIsDataViewPending()
  useEffect(() => {
    if (!isPendingView && queryKey) {
      checkHydrationParity(queryKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first mount only
  }, [])
}
