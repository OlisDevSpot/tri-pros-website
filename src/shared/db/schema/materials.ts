import type z from 'zod'

import { relations } from 'drizzle-orm'
import { integer, pgTable } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'

import { accessor, description, imageUrl, label, outcomeStatement, unsafeId } from '@/shared/db/lib/schema-helpers'

import { x_materialBenefits } from './x-material-benefits'
import { x_scopeMaterials } from './x-scope-materials'

export const materials = pgTable('material', {
  id: unsafeId,
  label,
  accessor: accessor.unique(),
  description,
  outcomeStatement,
  imageUrl,
  lifespan: integer('lifespan'),
  warranty: integer('warranty'),
})

export const materialRelations = relations(materials, ({ many }) => ({
  x_scopeMaterials: many(x_scopeMaterials),
  materialBenefits: many(x_materialBenefits),
}))

export const selectMaterialSchema = createSelectSchema(materials)
export type Material = z.infer<typeof selectMaterialSchema>

export const insertMaterialSchema = createInsertSchema(materials)
export type InsertMaterial = z.infer<typeof insertMaterialSchema>
