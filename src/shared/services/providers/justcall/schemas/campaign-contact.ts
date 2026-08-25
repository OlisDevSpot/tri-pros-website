import { z } from 'zod'

// Response envelope for `POST /sales_dialer/campaigns/contact` (upsert-on-phone).
// The numeric `data.id` is JustCall's contact id — persisted as
// voip_campaign_contacts.provider_contact_id (stringified).
export const jcAddContactToCampaignResponseSchema = z.object({
  status: z.string(),
  data: z.object({
    id: z.number(),
    name: z.string().optional(),
    phone_number: z.string(),
    status: z.string().optional(),
  }),
})
export type JcAddContactToCampaignResponse = z.infer<typeof jcAddContactToCampaignResponseSchema>
