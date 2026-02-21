import { z } from 'zod'

export const tradeSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['Energy Efficiency', 'General Construction', 'Structural / Functional']).optional(),
  homeOrLot: z.enum(['Home', 'Lot']).optional(),
  relatedScopes: z.array(z.string()).default([]),
})

export type Trade = z.infer<typeof tradeSchema>
