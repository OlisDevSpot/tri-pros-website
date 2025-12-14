import z from 'zod'

export const generalInquiryFormSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  email: z.email().min(1, { message: 'email is required' }),
  phone: z.string().min(1, { message: 'Phone is required' }),
  address: z.object({
    street: z.string().min(1, { message: 'Address is required' }),
    city: z.string().min(1, { message: 'City is required' }),
    state: z.string().min(1, { message: 'State is required' }),
    zipCode: z.string().min(1, { message: 'Zip code is required' }),
    fullAddress: z.string().optional(),
    location: z.object({
      lat: z.number(),
      lng: z.number(),
    }),
  }).optional(),
  inquiryDescription: z.string().min(1, { message: 'Description is required' }),
})

export type GeneralInquiryFormSchema = z.infer<typeof generalInquiryFormSchema>

export const defaultValues: GeneralInquiryFormSchema = {
  name: '',
  email: '',
  phone: '',
  inquiryDescription: '',
}
