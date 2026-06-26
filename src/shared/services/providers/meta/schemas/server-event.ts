import { z } from 'zod'

import { hashedId, unixSeconds } from '@/shared/services/providers/meta/schemas/primitives'

/**
 * user_data — identifiers Meta matches on. The hashed fields (`ph`/`em`/`fn`/
 * `ln`/`ct`/`st`/`zp`/`country`/`external_id`) are arrays of SHA-256 hashes
 * (advanced matching). `fbp`/`fbc` are the raw pixel cookies (NOT hashed).
 * `client_ip_address`/`client_user_agent` improve match quality. More valid
 * keys → higher Event Match Quality.
 */
export const metaUserDataSchema = z.object({
  ph: z.array(hashedId).optional(),
  em: z.array(hashedId).optional(),
  fn: z.array(hashedId).optional(),
  ln: z.array(hashedId).optional(),
  ct: z.array(hashedId).optional(),
  st: z.array(hashedId).optional(),
  zp: z.array(hashedId).optional(),
  country: z.array(hashedId).optional(),
  external_id: z.array(hashedId).optional(),
  fbp: z.string().optional(),
  fbc: z.string().optional(),
  client_ip_address: z.string().optional(),
  client_user_agent: z.string().optional(),
})

export const metaCustomDataSchema = z.object({
  content_category: z.string().optional(),
  content_name: z.string().optional(),
  value: z.number().optional(),
  currency: z.string().optional(),
}).passthrough()

export const metaServerEventSchema = z.object({
  event_name: z.string(),
  event_time: unixSeconds,
  event_id: z.string(),
  action_source: z.string(),
  event_source_url: z.string().optional(),
  user_data: metaUserDataSchema,
  custom_data: metaCustomDataSchema.optional(),
})

export type MetaServerEvent = z.infer<typeof metaServerEventSchema>
export type MetaUserData = z.infer<typeof metaUserDataSchema>
export type MetaCustomData = z.infer<typeof metaCustomDataSchema>
