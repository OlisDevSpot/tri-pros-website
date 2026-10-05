import { z } from 'zod'

// Response for `POST /texts/new` (outbound SMS). `data.id` is JustCall's
// message id — surfaced as providerMessageId for the cadence recorder.
export const jcSmsResponseSchema = z.object({
  status: z.string(),
  data: z.object({ id: z.number() }),
})
export type JcSmsResponse = z.infer<typeof jcSmsResponseSchema>
