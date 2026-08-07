// ─── getCachedSession ────────────────────────────────────────────────────────
// Request-scoped, deduped session accessor for RSC dashboard rendering.
//
// React cache() memoizes the result for the lifetime of a single server
// request, so the dashboard layout AND every page's protectDashboardPage()
// share ONE session→DB round-trip instead of each doing its own. Same request
// headers → same session, so memoization is always correct.
//
// This is the canonical way to read the session inside a dashboard RSC render.
// (The tRPC HTTP context resolves the session via its own cache() in
// create-http-context.ts — a separate memo that only fires on prefetching
// pages; consolidating the two is a possible follow-up.)

import { headers } from 'next/headers'
import { cache } from 'react'

import { auth } from '@/shared/domains/auth/server'

export const getCachedSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() })
})
