import z from 'zod'
import { intakeModes, leadTypes } from '@/shared/constants/enums'

export const leadSourceFormConfigSchema = z.object({
  leadType: z.enum(leadTypes),
  mode: z.enum(intakeModes),

  // Field visibility
  showEmail: z.boolean(),
  requireEmail: z.boolean(),
  showNotes: z.boolean(),

  // Meeting-mode-specific (ignored in customer_only mode)
  showMeetingScheduler: z.boolean().optional(),
  requireMeetingScheduler: z.boolean().optional(),
  showMp3Upload: z.boolean().optional(),
  closedByOptions: z.array(z.string()).optional(),
})

export type LeadSourceFormConfig = z.infer<typeof leadSourceFormConfigSchema>
