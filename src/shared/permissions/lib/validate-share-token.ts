// ─── Token Gate for Shareable Resources ─────────────────────────────────────
// This is a PARALLEL access path alongside CASL. It handles unauthenticated
// users who have a valid share token (e.g., homeowners viewing proposals
// via an emailed link with ?token=xxx).
//
// CASL handles: "does this authenticated user have permission?"
// Token gate handles: "does this URL token grant access to a resource?"
//
// They are siblings, not parent-child. A page checks one or the other:
//   1. Has ?token → validate here → render if valid
//   2. No token → check auth + CASL → render if permitted
//
// HOW TO ADD A NEW SHAREABLE RESOURCE:
// 1. Add the resource type to the ShareableResourceType union below
// 2. Add a case to the switch in validateShareToken
// 3. Use the same page-level pattern (token first, then CASL fallback)

import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { proposals } from '@/shared/db/schema'

type ShareableResourceType = 'proposal'

type TokenResult
  = | { valid: true, resourceId: string }
    | { valid: false }

export async function validateShareToken(
  token: string,
  resourceType: ShareableResourceType,
): Promise<TokenResult> {
  switch (resourceType) {
    case 'proposal': {
      const result = await db
        .select({ id: proposals.id })
        .from(proposals)
        .where(eq(proposals.token, token))
        .limit(1)

      if (result.length === 0) {
        return { valid: false }
      }

      return { valid: true, resourceId: result[0].id }
    }

    default:
      return { valid: false }
  }
}
