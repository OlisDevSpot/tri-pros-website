import { z } from 'zod'

export const tradeSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  coverImageUrl: z.string().nullable().default(null),
  type: z.enum(['Energy Efficiency', 'General Construction', 'Structural / Rough']).optional(),
  homeOrLot: z.enum(['Home', 'Lot']).optional(),
  relatedScopes: z.array(z.string()).default([]),
  disabled: z.boolean().default(false),
})

export type Trade = z.infer<typeof tradeSchema>
