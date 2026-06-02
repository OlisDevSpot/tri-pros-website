// Voip-messages business queries — composite-key thread fetch + other
// custom reads that don't fit through generic getById/listAll.
//
// see ../../DOCS.md for invariants (composite thread key)
// see docs/codebase-conventions/dal-conventions.md

import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { VoipMessage } from '@/shared/db/schema/voip-messages'

import { and, desc, eq } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { voipMessages } from '@/shared/db/schema/voip-messages'

interface FetchThreadInput {
  voipDidId: string
  remoteE164: string
  limit?: number
}

/**
 * Fetch a thread — all messages between a specific Tri Pros DID and a
 * customer phone, newest-first. Composite key `(voipDidId, remoteE164)` is
 * the indexed access path. Visibility scope is applied via `ctx.scope`.
 */
export async function fetchThread(
  ctx: ScopedContext,
  input: FetchThreadInput,
): Promise<DalReturn<VoipMessage[]>> {
  const limit = Math.min(input.limit ?? 50, 200)

  return dalDbOperation(async () => {
    const rows = await db
      .select()
      .from(voipMessages)
      .where(and(
        eq(voipMessages.voipDidId, input.voipDidId),
        eq(voipMessages.remoteE164, input.remoteE164),
        ctx.scope ?? undefined,
      ))
      .orderBy(desc(voipMessages.createdAt))
      .limit(limit)

    return rows
  })
}
