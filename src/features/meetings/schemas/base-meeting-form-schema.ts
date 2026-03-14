import z from 'zod'
import { situationProfileSchema } from '@/shared/entities/meetings/schemas'

export const meetingBaseSchema = z.object({
  notionContactId: z.string().optional(),
  situationProfile: situationProfileSchema,
})

export type MeetingBaseProfile = z.infer<typeof meetingBaseSchema>

export const defaultBaseMeetingValues: MeetingBaseProfile = {
  notionContactId: undefined,
  situationProfile: {},
}
