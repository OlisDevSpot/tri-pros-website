import { z } from 'zod'

// Response for `GET /sales_dialer/campaigns`. `type` is the JustCall dialer
// mode label ('Autodial' | 'Predictive' | 'Dynamic') — normalized to our
// DialerMode in the provider layer.
export const jcCampaignListResponseSchema = z.object({
  data: z.array(z.object({
    id: z.number(),
    name: z.string(),
    type: z.string(),
    status: z.string().optional(),
  })),
})
export type JcCampaignListResponse = z.infer<typeof jcCampaignListResponseSchema>
