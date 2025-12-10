import z from 'zod'

export const generalInquiryFormSchema = z.object({
  name: z.string(),
  email: z.email(),
  phone: z.string(),
  projectDescription: z.string(),
})

export type GeneralInquiryFormSchema = z.infer<typeof generalInquiryFormSchema>

export const defaultValues: GeneralInquiryFormSchema = {
  name: '',
  email: '',
  phone: '',
  projectDescription: '',
}
