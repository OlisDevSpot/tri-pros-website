import { z } from 'zod'

export const meetingSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  phone: z.string().nullable(),
  notes: z.string().default(''),
  meetingDatetime: z.string().nullable(),
  relatedContactId: z.string(),
  salesrepsAssigned: z.array(z.string()).default([]),
})

export type Meeting = z.infer<typeof meetingSchema>
