import type z from 'zod'
import { meetingBaseSchema } from '@/shared/entities/meetings/schemas'

export const tprMonthlySpecialSchema = meetingBaseSchema.extend({
})

export type TprMonthlySpecialSchema = z.infer<typeof tprMonthlySpecialSchema>
