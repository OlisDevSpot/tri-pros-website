import z from 'zod'
import { SERVICE_SLUGS } from '@/shared/constants/company/services'

// Inquiry-form project types: the 4 canonical services + an "other" catch-all
// for prospects who don't fit cleanly into a service bucket. Single source of
// truth — adding a service to SERVICE_SLUGS automatically expands this enum.
export const PROJECT_INQUIRY_TYPES = [...SERVICE_SLUGS, 'other'] as const

export type ProjectInquiryType = (typeof PROJECT_INQUIRY_TYPES)[number]

// --- General Inquiry Form ---

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
    }).nullable().optional(),
  }).optional(),
  inquiryDescription: z.string().min(1, { message: 'Description is required' }),
  // Both consents are OPTIONAL per TCR — required checkboxes are "forced consent."
  // SMS and call consent must be separate; do not bundle.
  smsConsent: z.boolean(),
  callConsent: z.boolean(),
})

export type GeneralInquiryFormSchema = z.infer<typeof generalInquiryFormSchema>

export const generalInquiryDefaultValues: GeneralInquiryFormSchema = {
  name: '',
  email: '',
  phone: '',
  inquiryDescription: '',
  smsConsent: false,
  callConsent: false,
}

// --- Schedule Consultation Form ---

export const scheduleConsultationFormSchema = z.object({
  name: z.string(),
  email: z.email(),
  phone: z.string(),
  projectType: z.enum(PROJECT_INQUIRY_TYPES),
  timeline: z.string(),
  budget: z.string(),
  propertyType: z.string(),
  propertySize: z.string(),
  location: z.string(),
  projectDescription: z.string(),
  // Both consents are OPTIONAL per TCR — required checkboxes are "forced consent."
  // SMS and call consent must be separate; do not bundle.
  smsConsent: z.boolean(),
  callConsent: z.boolean(),
})

export type ScheduleConsultationFormSchema = z.infer<typeof scheduleConsultationFormSchema>

export const scheduleConsultationDefaultValues: ScheduleConsultationFormSchema = {
  name: '',
  email: '',
  phone: '',
  projectType: 'energy-efficient-construction',
  timeline: '',
  budget: '',
  propertyType: '',
  propertySize: '',
  location: '',
  projectDescription: '',
  smsConsent: false,
  callConsent: false,
}
