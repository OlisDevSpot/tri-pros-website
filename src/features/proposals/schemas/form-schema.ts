import z from 'zod'
import { projectTypes } from '@/shared/constants/enums'

export const proposalFormSchema = z.object({
  homeowner: z.object({
    firstName: z.string().min(1, { message: 'First name is required' }),
    lastName: z.string().min(1, { message: 'Last name is required' }),
    email: z.string().min(1, { message: 'Email is required' }),
    phone: z.string().min(1, { message: 'Phone is required' }),
    address: z.string().min(1, { message: 'Address is required' }),
    city: z.string().min(1, { message: 'City is required' }),
    state: z.string().min(1, { message: 'State is required' }),
    zipCode: z.string().min(1, { message: 'Zip code is required' }),
    age: z.number().min(18, { message: 'You must be 18 or older' }),
  }).optional(),
  project: z.object({
    label: z.string().min(1, { message: 'Label is required' }),
    type: z.enum(projectTypes).default('general-remodeling').nonoptional(),
    timeAllocated: z.string().min(1, { message: 'Time allocated is required' }),
    sowSummary: z.string().min(1, { message: 'SOW summary is required' }),
  }).optional(),
  funding: z.object({
    tcp: z.number().min(1, { message: 'TCP is required' }),
    deposit: z.number().min(1, { message: 'Deposit is required' }),
    totalCash: z.number(),
  }).optional(),
})

export type ProposalFormValues = z.infer<typeof proposalFormSchema>

export const baseDefaultValues: ProposalFormValues = {
  homeowner: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    age: 40,
  },
  project: {
    type: 'general-remodeling',
    label: '',
    timeAllocated: '',
    sowSummary: '',
  },
  funding: {
    tcp: 0,
    deposit: 1000,
    totalCash: 0,
  },
}
