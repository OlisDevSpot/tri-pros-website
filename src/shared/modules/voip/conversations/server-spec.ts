import z from 'zod'

import { defineSubEntitySpec } from '@/shared/dal/server/lib/define-spec'
import { insertVoipConversationSchema, selectVoipConversationSchema, voipConversations } from '@/shared/db/schema/voip-conversations'
import { voipDidServerSpec } from '@/shared/entities/voip-dids/lib/server-spec'
import { VOIP_CONVERSATION } from '@/shared/modules/voip/conversations/lib/constants'

// The line and the number are fixed by the first text; archive and read are the only things anyone changes.
const updateVoipConversationSchema = z.object({
  archivedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  lastReadAt: z.iso.datetime({ offset: true }).nullable().optional(),
})

export const voipConversationSchemas = {
  insert: insertVoipConversationSchema,
  update: updateVoipConversationSchema,
}

export const voipConversationServerSpec = defineSubEntitySpec({
  entityName: VOIP_CONVERSATION,
  table: voipConversations,
  schemas: {
    insert: insertVoipConversationSchema,
    update: updateVoipConversationSchema,
    select: selectVoipConversationSchema,
  },
  parent: { spec: voipDidServerSpec, fk: voipConversations.voipDidId, field: 'conversations' },
})
