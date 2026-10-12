import type { ScopedContext } from '@/shared/dal/server/types'

import { bearerContext } from '@/shared/dal/server/lib/contexts'
import { getRequestActor } from '@/shared/domains/permissions/server/get-request-actor'
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import 'server-only'

/** The same order as the share procedure, for route handlers: a session wins, else the token's share link, else nothing. */
export async function shareRouteContext(token: string | null): Promise<{ ctx: ScopedContext, viaShareLink: boolean } | null> {
  const { session, actor } = await getRequestActor()
  if (session) {
    return { ctx: { actor, scope: null }, viaShareLink: false }
  }
  const bearer = token ? await bearerContext(proposalServerSpec, token) : null
  return bearer ? { ctx: bearer, viaShareLink: true } : null
}
