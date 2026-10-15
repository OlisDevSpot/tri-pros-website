import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { upsertConversation } from '@/shared/modules/voip/conversations/dal/server/mutations'
import { voipMessageServerSpec } from '@/shared/modules/voip/messages/server-spec'

/** Stable CRUD handlers for the voip-messages entity. Single instance, fully typed. */
export const voipMessageCrud = createCrudDal(voipMessageServerSpec, () => ({
  hooks: {
    create: {
      // Every text on a line belongs to that line's conversation with the number.
      async after(row) {
        if (row.voipDidId) {
          await upsertConversation({ voipDidId: row.voipDidId, remoteE164: row.remoteE164 })
        }
      },
    },
  },
}))
