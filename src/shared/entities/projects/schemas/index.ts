import { z } from 'zod'

// --- JSONB entity schemas ---

export const beforeAfterPairSchema = z.object({
  beforeMediaId: z.number(),
  afterMediaId: z.number(),
  label: z.string(),
  confidence: z.number().min(0).max(1),
})

export const beforeAfterPairsSchema = z.object({
  pairs: z.array(beforeAfterPairSchema),
})

export type BeforeAfterPair = z.infer<typeof beforeAfterPairSchema>
export type BeforeAfterPairs = z.infer<typeof beforeAfterPairsSchema>

// --- Form schemas ---

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
  beforeDescription: z.string().nullable().optional(),
  duringDescription: z.string().nullable().optional(),
  afterDescription: z.string().nullable().optional(),
  mainDescription: z.string().nullable().optional(),
  scopeIds: z.array(z.string()),
})

export type ProjectFormData = z.infer<typeof projectFormSchema>

/**
 * Schema for creating a business project (not a portfolio item).
 *  Address fields are pulled from the customer record on the server.
 */
export const createProjectFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(80),
  customerId: z.string().uuid(),
  meetingId: z.string().uuid('A meeting with a proposal is required'),
  description: z.string().max(500).nullable().optional(),
  projectDuration: z.string().max(40).nullable().optional(),
})

export type CreateProjectFormData = z.infer<typeof createProjectFormSchema>

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
  beforeDescription: null,
  duringDescription: null,
  afterDescription: null,
  mainDescription: null,
  scopeIds: [],
}
