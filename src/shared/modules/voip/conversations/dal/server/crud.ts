import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { voipConversationServerSpec } from '@/shared/modules/voip/conversations/server-spec'

export const voipConversationCrud = createCrudDal(voipConversationServerSpec, () => ({
  hooks: {
    update: {
      // The server's clock stamps both: archived and unread are decided against texts it timestamped.
      async before(data) {
        const now = new Date().toISOString()
        return {
          ...data,
          ...(data.archivedAt ? { archivedAt: now } : {}),
          ...(data.lastReadAt ? { lastReadAt: now } : {}),
        }
      },
    },
  },
}))
