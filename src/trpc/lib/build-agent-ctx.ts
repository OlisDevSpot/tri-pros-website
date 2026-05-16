// ─── build-agent-ctx ────────────────────────────────────────────────────────
// Resolves the `scope` field on BaseTRPCContext. Takes the authed ctx
// (session + ability already non-null from protectedProcedure) and computes
// the entity-level visibility scope.
//
// Visibility resolution:
//   - Omni callers (CASL `manage all`)  → scope = null   (L0 skips scoping)
//   - Non-omni callers                   → scope = spec.visibility(userId)

import type { AuthedContext, EntityServerSpec, ScopedContext } from '@/trpc/types'

export function buildAgentCtx(
  ctx: AuthedContext,
  spec: EntityServerSpec,
): ScopedContext {
  const isOmni = ctx.ability.can('manage', 'all')
  return {
    ...ctx,
    scope: isOmni ? null : spec.visibility(ctx.session.user.id),
  }
}
