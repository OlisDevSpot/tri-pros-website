import { z } from 'zod'

export const projectSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  relatedContactId: z.string(),
  salesrepsAssigned: z.array(z.string()).default([]),
})

export type Project = z.infer<typeof projectSchema>
