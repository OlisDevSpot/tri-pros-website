import { z } from 'zod'

export const projectFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(80),
  accessor: z.string().min(1, 'Slug is required').max(80),
  description: z.string().max(255).nullable().optional(),
  backstory: z.string().nullable().optional(),
  isPublic: z.boolean(),
  address: z.string().max(255).nullable().optional(),
  city: z.string().min(1, 'City is required').max(80),
  state: z.string().max(2).nullable().optional(),
  zip: z.string().max(5).nullable().optional(),
  hoRequirements: z.array(z.string()).nullable().optional(),
  homeownerName: z.string().max(80).nullable().optional(),
  homeownerQuote: z.string().nullable().optional(),
  projectDuration: z.string().max(40).nullable().optional(),
  completedAt: z.string().nullable().optional(),
  challengeDescription: z.string().nullable().optional(),
  solutionDescription: z.string().nullable().optional(),
  resultDescription: z.string().nullable().optional(),
  scopeIds: z.array(z.string()),
})

export type ProjectFormData = z.infer<typeof projectFormSchema>

export const projectFormDefaults: ProjectFormData = {
  title: '',
  accessor: '',
  description: null,
  backstory: null,
  isPublic: false,
  address: null,
  city: '',
  state: 'CA',
  zip: null,
  hoRequirements: null,
  homeownerName: null,
  homeownerQuote: null,
  projectDuration: null,
  completedAt: null,
  challengeDescription: null,
  solutionDescription: null,
  resultDescription: null,
  scopeIds: [],
}
