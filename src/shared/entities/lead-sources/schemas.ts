import z from 'zod'
import { leadTypes } from '@/shared/constants/enums'

export const leadSourceFormConfigSchema = z.object({
  leadType: z.enum(leadTypes),
  showEmail: z.boolean(),
  requireEmail: z.boolean(),
  showMeetingScheduler: z.boolean(),
  requireMeetingScheduler: z.boolean(),
  showMp3Upload: z.boolean(),
  showNotes: z.boolean(),
  closedByOptions: z.array(z.string()).optional(),
})

export type LeadSourceFormConfig = z.infer<typeof leadSourceFormConfigSchema>
