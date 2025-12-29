import type z from 'zod'

import type { HomeArea } from '@/shared/types/enums'

import { relations } from 'drizzle-orm'
import { integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { accessor, description, imageUrl, label, outcomeStatement, unsafeId } from '@/shared/db/lib/schema-helpers'

import { constructionTypeEnum } from './meta'
import { trades } from './trades'
import { x_projectScopes } from './x-project-scopes'
import { x_scopeBenefits } from './x-scope-benefits'
import { x_scopeMaterials } from './x-scope-materials'
import { x_scopeVariables } from './x-scope-variables'

export const scopes = pgTable('scopes', {
  id: unsafeId,
  label,
  accessor: accessor.unique(),
  description,
  outcomeStatement,
  imageUrl,
  scopeOfWorkBase: text('scope_of_work_base'),
  homeArea: jsonb('home_areas').$type<HomeArea[]>().notNull(),
  constructionType: constructionTypeEnum('construction_type').notNull(),
  tradeId: integer('trade_id')
    .notNull()
    .references(() => trades.id, { onDelete: 'cascade' }),
})

export const scopeRelations = relations(scopes, ({ one, many }) => ({
  trade: one(trades, {
    fields: [scopes.tradeId],
    references: [trades.id],
  }),
  x_projectScopes: many(x_projectScopes),
  x_scopeMaterials: many(x_scopeMaterials),
  x_scopeVariables: many(x_scopeVariables),
  x_scopeBenefits: many(x_scopeBenefits),
}))

export type Scope = typeof scopes.$inferSelect
export const selectScopeSchema = createSelectSchema(scopes)
export type SelectScopeSchema = z.infer<typeof selectScopeSchema>

export type InsertScope = typeof scopes.$inferInsert
export const insertScopeSchema = createInsertSchema(scopes).omit({
  id: true,
})
export type InsertScopeSchema = z.infer<typeof insertScopeSchema>

/*

HOOK
Outcome statement: A one sentence plain english PROMISE of the end state
  "generate your own power and cut dependenc eont he grid"
  "Extend roof life with a weather-tight overlay"

PREDICTABILITY LAYER
Before / after performance delta - energy savings, insulation gains, carbon footprint reduction, trees saved, etc
Aesthetic uplift - curb appeal increase, finish options
Step by step milestones -> a journey, not a manual
  "Assessment -> preparation -> removal / demo -> installation -> startup -> cleanup -> completion"
Duration windows -> scenario based timeframes (best / normal / bad / unpredictable)
Household disruption index -> simple rating (low / medium / high)
Warranty / service terms -> Clear, modular, confident

TECHNICAL LAYER
Scope of work - what is included, what is not included

TRUST LAYER
Compliance metadata - permits required, insepction requirements
Product & manufacturer provenance - certficiations, licenses, efficiency ratings, age

FINANCIAL LAYER
Resale impact (PV ROI positive / negative)

UPSELLING LAYER
Inter-scope synergy — How this scope pairs with others:
Solar wants roof condition. Windows want insulation. Roof overlay wants ventilation. This makes the upgrade path feel intelligent rather than random

PROMOTIONAL LAYER

*/
