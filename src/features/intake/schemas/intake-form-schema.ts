import z from 'zod'

export const intakeFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(7, 'Phone is required'),
  address: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().length(2).optional(),
  zip: z.string().min(3, 'ZIP is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  notes: z.string().optional(),
  scheduledFor: z.string().optional(),
  closedById: z.string().optional(),
  mp3Key: z.string().optional(), // R2 key after upload completes
  _honeypot: z.string().max(0, 'Bot detected').optional(),
})

export type IntakeFormValues = z.infer<typeof intakeFormSchema>
