// ─── build-agent-ctx ────────────────────────────────────────────────────────
// Internal helper. Converts a tRPC procedure ctx (session + ability) plus a
// spec into the framework-agnostic AgentCtx that L0 handlers consume.
//
// Visibility resolution:
//   - Omni callers (CASL `manage all`)  → scope = null   (L0 skips scoping)
//   - Non-omni callers                   → scope = spec.visibility(userId)
//
// For NestedEntitySpec (dormant in Phase 1a), the visibility resolver walks
// the parent chain per ADR-0002. Phase 1a only exercises the Core branch.

import type { AgentCtx, AppAbility, EntityServerSpec } from './types'

import type { BetterAuthSession } from '@/shared/domains/auth/server'

interface TRPCAuthedCtx {
  session: BetterAuthSession
  ability: AppAbility
}

export function buildAgentCtx(
  trpcCtx: TRPCAuthedCtx,
  spec: EntityServerSpec,
): AgentCtx {
  const isOmni = trpcCtx.ability.can('manage', 'all')

  if (isOmni) {
    return {
      session: trpcCtx.session,
      ability: trpcCtx.ability,
      scope: null,
    }
  }

  // For CoreEntitySpec: spec.visibility is required, call it directly.
  // For NestedEntitySpec: would walk parent chain (dormant in Phase 1a).
  if (spec.parentEntity === null) {
    return {
      session: trpcCtx.session,
      ability: trpcCtx.ability,
      scope: spec.visibility(trpcCtx.session.user.id),
    }
  }

  // Nested branch — not yet implemented. Phase 1a never reaches this code
  // path at runtime because no NestedEntitySpec is consumed.
  throw new Error(
    `[build-agent-ctx] NestedEntitySpec ('${spec.entityName}') is not yet `
    + 'supported. All Phase 1a entities must be CoreEntitySpec.',
  )
}
