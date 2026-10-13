import type { Actor } from '../actor'
import type { BetterAuthSession } from '@/shared/domains/auth/server'

import { redirect } from 'next/navigation'

import { getRequestActor } from '../server/get-request-actor'

export type DashboardAuthState
  = | { status: 'unauthenticated' }
    | { status: 'authenticated', session: BetterAuthSession, actor: Actor }

export async function protectDashboardPage(): Promise<DashboardAuthState> {
  const { session, actor } = await getRequestActor()

  // A logged-out agent may land here: the layout shows a sign-in prompt, so no redirect.
  if (!session) {
    return { status: 'unauthenticated' }
  }

  // Signed in but not internal: they do not belong in the dashboard.
  if (actor.ability.cannot('access', 'Dashboard')) {
    redirect('/')
  }

  return { status: 'authenticated', session, actor }
}
