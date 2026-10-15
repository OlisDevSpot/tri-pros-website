import z from 'zod'

import { visitMessageTemplateKeys } from '@/shared/modules/meetings/conversations/constants/kinds'

/** Wording changed for one visit, keyed like the team templates. A key that is absent uses the team's wording. */
export const visitMessageOverridesSchema = z.partialRecord(z.enum(visitMessageTemplateKeys), z.string().trim().min(1).max(1600))
export type VisitMessageOverrides = z.infer<typeof visitMessageOverridesSchema>
