import { z } from 'zod'

import { agentProfileSchema } from '@/shared/entities/agents/schemas'

export const identityFormSchema = z.object({
  phone: z.string().optional(),
  birthdate: z.string().optional(),
  startDate: z.string().optional(),
  funFact: z.string().optional(),
})

export type IdentityFormValues = z.infer<typeof identityFormSchema>

export const brandFormSchema = agentProfileSchema.omit({
  headshotUrl: true,
  headshotCropData: true,
})

export type BrandFormValues = z.infer<typeof brandFormSchema>
