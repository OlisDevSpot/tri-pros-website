import { db } from '@/shared/db'
import { voipConversations } from '@/shared/db/schema/voip-conversations'

/** The conversation a text belongs to; its first text creates it. */
export async function upsertConversation(input: { voipDidId: string, remoteE164: string }): Promise<void> {
  await db
    .insert(voipConversations)
    .values(input)
    .onConflictDoNothing({ target: [voipConversations.voipDidId, voipConversations.remoteE164] })
}
