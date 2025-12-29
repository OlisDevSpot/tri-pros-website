import z from 'zod'
import { projectTypes } from '@/shared/constants/enums'

export const scheduleConsultationFormSchema = z.object({
  name: z.string(),
  email: z.email(),
  phone: z.string(),
  projectType: z.enum(projectTypes),
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
  projectType: 'general-remodeling',
  timeline: '',
  budget: '',
  propertyType: '',
  propertySize: '',
  location: '',
  projectDescription: '',
}
