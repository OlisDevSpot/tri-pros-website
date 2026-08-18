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
