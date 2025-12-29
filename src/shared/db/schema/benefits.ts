import type z from 'zod'

import { relations } from 'drizzle-orm'
import { integer, pgTable, text } from 'drizzle-orm/pg-core'

import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { unsafeId } from '@/shared/db/lib/schema-helpers'
import { benefitCategories } from './benefit-categories'
import { x_materialBenefits } from './x-material-benefits'
import { x_tradeBenefits } from './x-trade-benefits'

export const benefits = pgTable('benefits', {
  id: unsafeId,
  accessor: text('accessor').notNull().unique(),
  content: text('content').notNull(),
  lucideIcon: text('lucide_icon'),
  categoryId: integer('category_id')
    .notNull()
    .references(() => benefitCategories.id, { onDelete: 'cascade' }),
})

export const benefitRelations = relations(benefits, ({ one, many }) => ({
  x_tradeBenefits: many(x_tradeBenefits),
  materialBenefits: many(x_materialBenefits),
  benefitCategories: one(benefitCategories, {
    fields: [benefits.categoryId],
    references: [benefitCategories.id],
  }),
}))

export const selectBenefitSchema = createSelectSchema(benefits)
export type Benefit = z.infer<typeof selectBenefitSchema>

export const insertBenefitSchema = createInsertSchema(benefits).omit({
  id: true,
})
export type InsertBenefit = z.infer<typeof insertBenefitSchema>
