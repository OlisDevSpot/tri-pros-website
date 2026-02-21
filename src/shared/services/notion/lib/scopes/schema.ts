import { z } from 'zod'

export const scopeOrAddonSchema = z.object({
  id: z.string(),
  name: z.string(),
  entryType: z.string(),
  unitOfPricing: z.string().default('unit'),
  relatedTrade: z.string(),
  relatedScopesOfWork: z.array(z.string()).default([]).optional(),
})

export type ScopeOrAddon = z.infer<typeof scopeOrAddonSchema>
