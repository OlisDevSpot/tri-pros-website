import { z } from 'zod'

export const contactSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  email: z.string().optional().nullable(),
  address: z.string().nullable(),
  state: z.string().nullable(),
  city: z.string().default(''),
  zip: z.string().default('CA'),
  ownerId: z.array(z.string()).default([]),
  notes: z.string().default(''),
  phone: z.string().nullable(),
  relatedMeetingsIds: z.array(z.string()).default([]),
  relatedProjectsIds: z.array(z.string()).default([]),
  initMeetingAt: z.string().nullable(),
})

export type Contact = z.infer<typeof contactSchema>
