import { z } from 'zod'

export const sowSchema = z.object({
  id: z.string(),
  name: z.string(),
  relatedScope: z.array(z.string()).default([]).optional(),
})

export type SOW = z.infer<typeof sowSchema>
