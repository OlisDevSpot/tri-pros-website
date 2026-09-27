import { z } from 'zod'

import { CURRENT_ROOF_TYPES } from '@/features/calculators/scope-pricing-calculator/constants/project-context'

// Stories and roof type are typed in by the rep until they can be prefilled from the customer's profile.
export const projectContextSchema = z.object({
  numStories: z.number().int().min(1).max(4),
  currentRoofType: z.enum(CURRENT_ROOF_TYPES),
})

export type ProjectContext = z.infer<typeof projectContextSchema>
