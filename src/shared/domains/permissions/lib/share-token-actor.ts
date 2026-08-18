import type { Actor } from '@/shared/domains/permissions/scope/actor'

import { eq } from 'drizzle-orm'

import { proposals } from '@/shared/db/schema'
import { validateShareToken } from '@/shared/domains/permissions/lib/validate-share-token'
import { tokenActor } from '@/shared/domains/permissions/scope/actor'

/**
 * The ONE canonical bearer-token → Actor path. Validates the share token and,
 * on success, returns a `tokenActor` whose scope is narrowed to the resolved
 * row (row-boundary is the scope; the verb-boundary is which endpoint accepts
 * the token — a tokenActor carries no ability). Replaces the hand-rolled
 * `proposal.token !== token` compares scattered across the view routes.
 * Note: a valid token whose resolved proposal id doesn't match the
 * requested proposalId now surfaces as NOT_FOUND (404) at call sites, not
 * UNAUTHORIZED (401), since the read is scoped to the token's proposal and
 * filtered by the requested id — intentional, to avoid leaking existence.
 * see docs/plans/2026-08-10-casl-scope-compiler-epic.md (Actor-seam conventions §3)
 */
export async function resolveShareTokenActor(
  token: string,
  resourceType: 'proposal',
): Promise<Actor | null> {
  const result = await validateShareToken(token, resourceType)
  if (!result.valid)
    return null
  return tokenActor(eq(proposals.id, result.resourceId), 'Proposal')
}
