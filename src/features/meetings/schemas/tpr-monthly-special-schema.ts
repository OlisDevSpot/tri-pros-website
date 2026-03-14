import type z from 'zod'
import { meetingBaseSchema } from '@/features/meetings/schemas/base-meeting-form-schema'

export const tprMonthlySpecialSchema = meetingBaseSchema.extend({
})

export type TprMonthlySpecialSchema = z.infer<typeof tprMonthlySpecialSchema>
