import z from 'zod'

export const scheduleConsultationFormSchema = z.object({
  name: z.string(),
  email: z.email(),
  phone: z.string(),
  projectType: z.string(),
  timeline: z.string(),
  budget: z.string(),
  propertyType: z.string(),
  propertySize: z.string(),
  location: z.string(),
  projectDescription: z.string(),
})

export type ScheduleConsultationFormSchema = z.infer<typeof scheduleConsultationFormSchema>

export const defaultValues: ScheduleConsultationFormSchema = {
  name: '',
  email: '',
  phone: '',
  projectType: '',
  timeline: '',
  budget: '',
  propertyType: '',
  propertySize: '',
  location: '',
  projectDescription: '',
}
