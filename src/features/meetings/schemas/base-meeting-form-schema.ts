import z from 'zod'
import { meetingContextSchema } from '@/shared/entities/meetings/schemas'

export const meetingBaseSchema = z.object({
  notionContactId: z.string().optional(),
  context: meetingContextSchema,
})

export type MeetingBaseProfile = z.infer<typeof meetingBaseSchema>

export const defaultBaseMeetingValues: MeetingBaseProfile = {
  notionContactId: undefined,
  context: {},
}
