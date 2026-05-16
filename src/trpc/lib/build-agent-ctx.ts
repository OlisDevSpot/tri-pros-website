// ─── build-agent-ctx ────────────────────────────────────────────────────────
// Internal helper. Converts a tRPC procedure ctx (session + ability) plus a
// spec into the framework-agnostic AgentCtx that L0 handlers consume.
//
// Visibility resolution:
//   - Omni callers (CASL `manage all`)  → scope = null   (L0 skips scoping)
//   - Non-omni callers                   → scope = spec.visibility(userId)

import type { BetterAuthSession } from '@/shared/domains/auth/server'
import type { AppAbility } from '@/shared/domains/permissions/types'
import type { AgentCtx, EntityServerSpec } from '@/trpc/types'

interface TRPCAuthedCtx {
  session: BetterAuthSession
  ability: AppAbility
}

export function buildAgentCtx(
  trpcCtx: TRPCAuthedCtx,
  spec: EntityServerSpec,
): AgentCtx {
  const isOmni = trpcCtx.ability.can('manage', 'all')
  return {
    session: trpcCtx.session,
    ability: trpcCtx.ability,
    scope: isOmni ? null : spec.visibility(trpcCtx.session.user.id),
  }
}
