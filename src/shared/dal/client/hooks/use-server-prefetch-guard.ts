'use client'

import { isServer, useQueryClient } from '@tanstack/react-query'

/**
 * Dev-only. A suspense read the page did not prefetch runs during SSR through `httpBatchLink`, which carries none of
 * the viewer's cookies, so it fails or reads as signed out. Every server-rendered data view must prefetch its exact key.
 */
export function useServerPrefetchGuard(queryKey: readonly unknown[], active: boolean): void {
  const qc = useQueryClient()
  // eslint-disable-next-line node/prefer-global/process
  if (active && isServer && process.env.NODE_ENV !== 'production' && qc.getQueryState(queryKey) === undefined) {
    console.error(`[data-view] suspense read on the server without a prefetch: ${JSON.stringify(queryKey[0])}. Prefetch this exact input in the page.`)
  }
}
