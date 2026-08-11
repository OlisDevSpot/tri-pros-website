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
