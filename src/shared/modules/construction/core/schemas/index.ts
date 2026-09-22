import { z } from 'zod'

import { painPointCategories, painPointEmotionalDrivers, painPointSeverities, painPointUrgencies } from '@/shared/constants/enums/pain-points'

/**
 * Neutral construction-catalog schemas. Nothing here names a vendor: these are
 * the shapes the app reasons about, whoever supplies the rows.
 * see ../../DOCS.md#neutral-schemas
 */

/** Live Notion `Type` select values, verbatim. Reconciling these with `constants/enums.ts`'s `constructionTypes` is P2 — see ../../DOCS.md#category-taxonomy */
export const tradeCategories = [
  'Energy Efficiency',
  'General Construction',
  'Structural / Rough',
] as const
export type TradeCategory = (typeof tradeCategories)[number]

export const scopeKinds = ['scope', 'addon'] as const
export type ScopeKind = (typeof scopeKinds)[number]

export const tradeSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  coverImageUrl: z.string().nullable().default(null),
  category: z.enum(tradeCategories).optional(),
  scopeIds: z.array(z.string()).default([]),
})
export type Trade = z.infer<typeof tradeSchema>

export const scopeSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(scopeKinds).default('scope'),
  unitOfPricing: z.string().default('unit'),
  coverImageUrl: z.string().nullable().default(null),
  tradeId: z.string(),
  sowIds: z.array(z.string()).default([]),
})
export type Scope = z.infer<typeof scopeSchema>

/** A reusable statement-of-work template attached to scopes. Named `SowTemplate`, not `SOW`, because `modules/proposals/core/types.ts` already owns `SOW` — a proposal's own written scope. */
export const sowTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  scopeIds: z.array(z.string()).default([]),
})
export type SowTemplate = z.infer<typeof sowTemplateSchema>

export const painPointSchema = z.object({
  id: z.string(),
  name: z.string(),
  accessor: z.string(),
  category: z.enum(painPointCategories).optional(),
  severity: z.enum(painPointSeverities).optional(),
  urgency: z.enum(painPointUrgencies).optional(),
  emotionalDrivers: z.array(z.enum(painPointEmotionalDrivers)).default([]),
  trades: z.array(z.string()).default([]),
  householdResonance: z.array(z.string()).default([]),
  programFit: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
})
export type PainPoint = z.infer<typeof painPointSchema>
