import { z } from 'zod'

export const identityFormSchema = z.object({
  phone: z.string().optional(),
  birthdate: z.string().optional(),
  startDate: z.string().optional(),
  funFact: z.string().optional(),
})

export type IdentityFormValues = z.infer<typeof identityFormSchema>

// Flat subset of the users patch shape this form owns (headshotUrl /
// headshotCropData are the headshot-upload widget's fields, not this form's).
export const brandFormSchema = z.object({
  quote: z.string().optional(),
  bio: z.string().optional(),
  yearsOfExperience: z.number().optional(),
  tradeSpecialties: z.array(z.string()).optional(),
  languagesSpoken: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
})

export type BrandFormValues = z.infer<typeof brandFormSchema>
