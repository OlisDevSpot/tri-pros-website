import { z } from 'zod'

// Input shape for the JWT mint. The caller (Slug C/D access-token route) parses
// the inbound request body against this before forwarding to `mintVoiceAccessToken`.
// Provider exposes the Zod so the route handler doesn't reinvent the shape.

export const mintVoiceAccessTokenInputSchema = z.object({
  // Identity claim — typically the authed user's id (text, per better-auth).
  identity: z.string().min(1),
  // Optional override (seconds). Default applied in `mintVoiceAccessToken`.
  ttlSeconds: z.number().int().positive().max(86400).optional(),
  // Optional params forwarded to the TwiML App on outbound dial. Values are
  // stringified by Twilio's grant — keep this Record<string, string>.
  outgoingApplicationParams: z.record(z.string(), z.string()).optional(),
})

export type MintVoiceAccessTokenInput = z.infer<typeof mintVoiceAccessTokenInputSchema>
