// ─── Dashboard Page Protection ──────────────────────────────────────────────
// Server-side helper for dashboard pages. Call this from the page's
// server component to determine what the client view should render.
//
// Returns a discriminated union:
//   { status: 'unauthenticated' }       → show sign-in prompt, no redirect
//   { status: 'authenticated', ... }    → full dashboard
//
// If the user is authenticated but NOT internal, this redirects to '/'
// (they don't belong in the dashboard).
//
// USAGE in a dashboard page server component:
//   const authState = await protectDashboardPage()
//   return <DashboardView authState={authState} />

import type { AppAbility } from '../types'
import type { BetterAuthSession } from '@/shared/auth/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/shared/auth/server'
import { defineAbilitiesFor } from '../abilities'

export type DashboardAuthState
  = | { status: 'unauthenticated' }
    | { status: 'authenticated', session: BetterAuthSession, ability: AppAbility }

export async function protectDashboardPage(): Promise<DashboardAuthState> {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders })

  // State 1: No session — could be a logged-out agent. Don't redirect,
  // let the UI show a sign-in prompt.
  if (!session) {
    return { status: 'unauthenticated' }
  }

  // State 2: Authenticated but not internal — redirect home.
  const ability = defineAbilitiesFor({
    id: session.user.id,
    role: session.user.role,
  })

  if (ability.cannot('access', 'Dashboard')) {
    redirect('/')
  }

  // State 3: Internal user — proceed with full dashboard.
  // Return ability so the client view can do granular permission checks
  // without rebuilding it.
  return { status: 'authenticated', session, ability }
}
