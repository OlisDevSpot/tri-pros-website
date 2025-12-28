import { relations } from 'drizzle-orm'

import {
  jsonb,
  pgTable,
  varchar,
} from 'drizzle-orm/pg-core'
import { unsafeId } from '@/db/lib/schema-helpers'

import { dataTypeEnum } from './meta'
import { x_scopeVariables } from './x-scope-variables'

export const variables = pgTable('variable', {
  id: unsafeId,
  key: varchar('key', { length: 80 }).notNull().unique(),
  label: varchar('label', { length: 80 }).notNull(),
  dataType: dataTypeEnum('data_type').notNull(),
  description: varchar('description', { length: 255 }),
  options: jsonb('options').$type<string[] | number[]>(),
})

export const variableRelations = relations(variables, ({ many }) => ({
  x_scopeVariables: many(x_scopeVariables),
}))

export type Variable = typeof variables.$inferSelect
export type InsertVariable = typeof variables.$inferInsert
