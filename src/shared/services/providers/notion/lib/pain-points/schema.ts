import { z } from 'zod'

import { painPointCategories, painPointEmotionalDrivers, painPointSeverities, painPointUrgencies } from '@/shared/constants/enums/pain-points'

export const notionPainPointSchema = z.object({
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

export type NotionPainPoint = z.infer<typeof notionPainPointSchema>
