'use client'

import { useEffect } from 'react'

import { checkHydrationParity } from '@/shared/lib/hydration-drift'

/**
 * Dev-only: call with the exact queryOptions.queryKey a suspense view mounts,
 * to detect server-prefetch drift (see hydration-drift.ts). No-op in prod.
 */
export function useHydrationParityCheck(queryKey: readonly unknown[]): void {
  useEffect(() => {
    checkHydrationParity(queryKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first mount only
  }, [])
}
