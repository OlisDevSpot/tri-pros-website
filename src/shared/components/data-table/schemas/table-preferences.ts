import { z } from 'zod'

/** One table's viewer choices. Every field is optional: an absent one means the table's default. */
export const tablePreferencesSchema = z.object({
  /** Column id → width in px. */
  sizes: z.record(z.string(), z.number()).optional(),
  /** Whether the first column sticks while the table scrolls sideways. */
  frozen: z.boolean().optional(),
  /** Column id → visible, only where the viewer departed from the column's default. */
  visibility: z.record(z.string(), z.boolean()).optional(),
})

export type TablePreferences = z.infer<typeof tablePreferencesSchema>
