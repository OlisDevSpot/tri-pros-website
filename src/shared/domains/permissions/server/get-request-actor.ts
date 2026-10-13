import type { BetterAuthSession } from '@/shared/domains/auth/server'

import type { Actor } from '@/shared/domains/permissions/actor'

import { headers } from 'next/headers'
import { cache } from 'react'

import { assertRulesCompile } from '@/shared/dal/server/lib/permissions/check-rules'
import { auth } from '@/shared/domains/auth/server'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
import 'server-only'

// Once per server process: the first request of a process with a rule the interpreter rejects fails here.
assertRulesCompile()

interface RequestActor {
  session: BetterAuthSession | null
  actor: Actor
}

// Memoized per server render, so a layout, its pages, their guards and the tRPC prefetch context
// share one session read and one ability build. In a route handler React's `cache` does not
// memoize, and tRPC's adapter already builds its context once per HTTP batch.
export const getRequestActor = cache(async (): Promise<RequestActor> => {
  const session = await auth.api.getSession({ headers: await headers() })
  const ability = defineAbilitiesFor(session ? { id: session.user.id, role: session.user.role } : null)
  return { session, actor: { ability, userId: session?.user.id ?? null } }
})
