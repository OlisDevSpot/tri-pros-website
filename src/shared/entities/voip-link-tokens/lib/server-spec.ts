import type { EntityServerSpec } from '@/shared/dal/server/types'
import { insertVoipLinkTokenSchema, selectVoipLinkTokenSchema, voipLinkTokens } from '@/shared/db/schema'
import { VOIP_LINK_TOKEN } from './constants'
import { voipLinkTokenVisibility } from './visibility'

const updateVoipLinkTokenSchema = insertVoipLinkTokenSchema.partial()

export const voipLinkTokenSchemas = {
  insert: insertVoipLinkTokenSchema,
  update: updateVoipLinkTokenSchema,
}

export const voipLinkTokenServerSpec = {
  entityName: VOIP_LINK_TOKEN,
  caslSubject: VOIP_LINK_TOKEN,
  visibility: voipLinkTokenVisibility,
  table: voipLinkTokens,
  schemas: {
    insert: insertVoipLinkTokenSchema,
    update: updateVoipLinkTokenSchema,
    select: selectVoipLinkTokenSchema,
  },
  // see ../DOCS.md#shareable-via-token-column
  // Customer consume route hits `/api/voip/links/[token]` (Task 29) without a
  // session — shareable middleware looks up the row via this column and
  // attaches a synthetic context so the existing getById/update slots Just Work.
  shareable: { tokenColumn: 'token' },
} satisfies EntityServerSpec<typeof voipLinkTokens>
