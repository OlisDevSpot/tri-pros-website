import type z from 'zod'
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { createSelectSchema } from 'drizzle-zod'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'

export const qbAuthTokens = pgTable('qb_auth_tokens', {
  id,
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  realmId: text('realm_id').notNull(),
  expiresAt: timestamp('expires_at', { mode: 'string', withTimezone: true }).notNull(),
  createdAt,
  updatedAt,
})

export const selectQbAuthTokenSchema = createSelectSchema(qbAuthTokens)
export type QbAuthToken = z.infer<typeof selectQbAuthTokenSchema>
