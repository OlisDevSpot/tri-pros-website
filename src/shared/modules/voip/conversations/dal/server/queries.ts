import type { ScopedContext } from '@/shared/dal/server/types'
import type { VoipConversation } from '@/shared/db/schema/voip-conversations'

import { and, eq } from 'drizzle-orm'

import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { db } from '@/shared/db'
import { voipConversations } from '@/shared/db/schema/voip-conversations'
import { voipConversationServerSpec } from '@/shared/modules/voip/conversations/server-spec'

export async function getConversationByLine(ctx: ScopedContext, input: { voipDidId: string, remoteE164: string }): Promise<VoipConversation | null> {
  const [row] = await db
    .select()
    .from(voipConversations)
    .where(and(
      eq(voipConversations.voipDidId, input.voipDidId),
      eq(voipConversations.remoteE164, input.remoteE164),
      permit(ctx, 'read', voipConversationServerSpec).sql,
    ))
    .limit(1)
  return row ?? null
}
