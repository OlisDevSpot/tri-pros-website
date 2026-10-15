/**
 * One conversation row for every line and number that already has texts, so conversations from before the table existed open.
 * Idempotent.
 *
 *   DRIZZLE_TARGET=dev pnpm tsx scripts/backfill-voip-conversations.ts [--apply]
 */
/* eslint-disable perfectionist/sort-imports -- load-env must run before any module that reads process.env */
import './lib/load-env'
import process from 'node:process'
import { count, isNotNull } from 'drizzle-orm'
import { db } from '@/shared/db'
import { voipConversations } from '@/shared/db/schema/voip-conversations'
import { voipMessages } from '@/shared/db/schema/voip-messages'
/* eslint-enable perfectionist/sort-imports */

async function main() {
  const apply = process.argv.includes('--apply')
  const pairs = await db
    .selectDistinct({ voipDidId: voipMessages.voipDidId, remoteE164: voipMessages.remoteE164 })
    .from(voipMessages)
    .where(isNotNull(voipMessages.voipDidId))
  const [existing] = await db.select({ rows: count() }).from(voipConversations)
  console.log(`conversations with texts: ${pairs.length}; rows already: ${existing?.rows ?? 0}`)
  if (!apply) {
    console.log('dry run; pass --apply to write')
    return
  }
  if (pairs.length > 0) {
    await db
      .insert(voipConversations)
      .values(pairs.map(pair => ({ voipDidId: pair.voipDidId!, remoteE164: pair.remoteE164 })))
      .onConflictDoNothing({ target: [voipConversations.voipDidId, voipConversations.remoteE164] })
  }
  console.log('done')
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error)
  process.exit(1)
})
