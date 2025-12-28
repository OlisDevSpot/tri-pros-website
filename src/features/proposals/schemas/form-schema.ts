import z from 'zod'

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
  }).optional(),
  project: z.object({
    type: z.enum(['energy-efficient', 'general remodeling']),
    timeAllocated: z.string().min(1, { message: 'Time allocated is required' }),
    sowSummary: z.string().min(1, { message: 'SOW summary is required' }),
    startDate: z.string().min(1, { message: 'Start date is required' }),
    completionDate: z.string().min(1, { message: 'Completion date is required' }),
  }).optional(),
  funding: z.object({
    tcp: z.number().min(1, { message: 'TCP is required' }),
    deposit: z.number().min(1, { message: 'Deposit is required' }),
    fundingType: z.enum(['loan', 'cash', 'mixed']),
    totalCash: z.number(),
    totalLoan: z.number(),
  }).optional(),
})

export type ProposalFormValues = z.infer<typeof proposalFormSchema>

export const defaultValues: ProposalFormValues = {
  homeowner: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
  },
  project: {
    type: 'energy-efficient',
    timeAllocated: '',
    sowSummary: '',
    startDate: '',
    completionDate: '',
  },
  funding: {
    tcp: 0,
    deposit: 0,
    fundingType: 'loan',
    totalCash: 0,
    totalLoan: 0,
  },
}
