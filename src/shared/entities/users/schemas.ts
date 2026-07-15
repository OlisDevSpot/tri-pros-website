import { z } from 'zod'

export const cropDataSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
})

// Still live — types the `headshotCropData` JSONB column (single-writer,
// replaced-whole, two fixed sub-objects; not decomposed per spec §2).
export const headshotCropDataSchema = z.object({
  app: cropDataSchema.optional(),
  proposal: cropDataSchema.optional(),
})

export type HeadshotCropData = z.infer<typeof headshotCropDataSchema>

/**
 * @deprecated Wave-1 frozen (epic #256/#259). Kept only to type the
 * deprecated `agentProfileJSONDeprecated` blob column and for
 * scripts/backfill-wave1-columns.ts parsing. New code reads/writes the flat
 * columns directly; see users/dal/server/mutations.ts#updateUserProfile.
 */
export const agentProfileSchema = z.object({
  quote: z.string().optional(),
  bio: z.string().optional(),
  yearsOfExperience: z.number().optional(),
  tradeSpecialties: z.array(z.string()).optional(),
  languagesSpoken: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  headshotUrl: z.string().optional(),
  headshotCropData: headshotCropDataSchema.optional(),
})

export type AgentProfile = z.infer<typeof agentProfileSchema>
