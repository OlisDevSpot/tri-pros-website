// Zod for Meta Marketing-API ad-level Insights rows (raw wire shape).
// All metrics arrive as STRINGS; actions are nested arrays. Coercion → domain
// numbers happens in meta-insights-sync.service.ts, not here.
import { z } from 'zod'

const actionEntrySchema = z.object({
  action_type: z.string(),
  value: z.string(),
})

export const metaAdInsightRowSchema = z
  .object({
    ad_id: z.string(),
    ad_name: z.string().optional(),
    spend: z.string().optional(),
    impressions: z.string().optional(),
    reach: z.string().optional(),
    frequency: z.string().optional(),
    cpm: z.string().optional(),
    ctr: z.string().optional(),
    cpc: z.string().optional(),
    inline_link_clicks: z.string().optional(),
    actions: z.array(actionEntrySchema).optional(),
    cost_per_action_type: z.array(actionEntrySchema).optional(),
    date_start: z.string().optional(),
    date_stop: z.string().optional(),
  })
  .passthrough()

export type MetaAdInsightRaw = z.infer<typeof metaAdInsightRowSchema>

export const metaAdInsightsResponseSchema = z.object({
  data: z.array(metaAdInsightRowSchema),
  paging: z
    .object({
      next: z.string().optional(),
      cursors: z.object({ after: z.string().optional() }).optional(),
    })
    .optional(),
})

export type MetaAdInsightsResponse = z.infer<typeof metaAdInsightsResponseSchema>
