import { z } from 'zod'

// Response for `GET /v2.1/sales_dialer/contacts/custom-fields` (verified against
// developer.justcall.io 2026-08-19). Each row is `{ key, label, type }`: `key`
// is the numeric custom-field id JustCall requires in `custom_fields:[{id,value}]`
// on enroll; `label` is the dashboard label the resync maps to our app_key.
export const jcContactFieldsResponseSchema = z.object({
  data: z.array(z.object({
    key: z.number(),
    label: z.string(),
    type: z.string().optional(),
  })),
})
export type JcContactFieldsResponse = z.infer<typeof jcContactFieldsResponseSchema>
