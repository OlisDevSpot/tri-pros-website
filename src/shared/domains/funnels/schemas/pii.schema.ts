import z from 'zod'

export const piiSchema = z.object({
  name: z.string().min(1, 'Please enter your name'),
  phone: z.string().min(7, 'Please enter a valid phone'),
  email: z.email('Please enter a valid email'),
  city: z.string().min(1, 'Please enter your city'),
  consent: z.literal(true, { message: 'Please agree to be contacted' }),
  _honeypot: z.string().max(0).optional(),
})
export type PiiFormData = z.infer<typeof piiSchema>
