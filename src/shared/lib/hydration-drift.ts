import { hashKey } from '@tanstack/react-query'

// Dev-only prefetch-drift detector. The server records every dehydrated query
// key; client hooks check on first mount whether a recorded key shares their
// tRPC path but hashes differently — the signature of a server/client input
// mismatch (drifted table config, mismatched `extra`, client-only input).
// All functions are no-ops in production.

interface HydrationDriftGlobals {
  __hydratedQueryKeys?: unknown[][]
  __hydrationDriftWarned?: Set<string>
}

function devWindow(): (Window & HydrationDriftGlobals) | undefined {
  // eslint-disable-next-line node/prefer-global/process
  if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') {
    return undefined
  }
  return window as Window & HydrationDriftGlobals
}

/** Called by the recorder component with the keys the server just dehydrated. Replaces the previous page's record. */
export function recordHydratedKeys(keys: unknown[][]): void {
  const w = devWindow()
  if (!w) {
    return
  }
  w.__hydratedQueryKeys = keys
  w.__hydrationDriftWarned = new Set()
}

/**
 * Called by client hooks on first mount. Warns when a hydrated key shares this key's tRPC path
 * but hashes differently. Consumes every hydrated key on this path once checked — a path is only
 * ever compared against the render right after server hydration, so a later remount on the same
 * path (nuqs changing the URL with no server round trip, or React StrictMode's dev double-mount)
 * finds nothing recorded and stays silent instead of comparing against a now-stale server key.
 */
export function checkHydrationParity(queryKey: readonly unknown[]): void {
  const w = devWindow()
  if (!w?.__hydratedQueryKeys?.length) {
    return
  }
  const myPath = JSON.stringify(queryKey[0])
  const sharedPathKeys = w.__hydratedQueryKeys.filter(k => JSON.stringify(k[0]) === myPath)
  if (sharedPathKeys.length === 0) {
    return // no hydrated key shares this path — this page just doesn't prefetch it, not drift
  }
  w.__hydratedQueryKeys = w.__hydratedQueryKeys.filter(k => JSON.stringify(k[0]) !== myPath)

  const myHash = hashKey(queryKey as unknown[])
  if (sharedPathKeys.some(hydratedKey => hashKey(hydratedKey) === myHash)) {
    return // exact hit — prefetch will be consumed
  }
  // Same-path key was hydrated but none hash-matched → drift.
  const warnId = `${myPath}:${myHash}`
  if (w.__hydrationDriftWarned?.has(warnId)) {
    return
  }
  w.__hydrationDriftWarned?.add(warnId)
  console.error(
    `[prefetch drift] the server hydrated a query for path ${myPath} but the client mounted a different input — the prefetch was wasted. Check shared-config / extra parity between page.tsx and the view. Hydrated keys:`,
    sharedPathKeys,
    'client key:',
    queryKey,
  )
}
