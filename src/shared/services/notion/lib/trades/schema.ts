import { z } from 'zod'

export const tradeSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string().optional(),
  homeOrLot: z.string().optional(),
  relatedScopes: z.array(z.string()).default([]),
})

export type Trade = z.infer<typeof tradeSchema>
