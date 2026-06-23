# Meta provider (Pixel + Conversions API)

Server-only Graph API client for the Conversions API (CAPI). The browser Pixel
(`fbq`) is NOT here — it lives in `src/shared/domains/funnels/lib/tracking/`
(providers are server-only).

## Invariants
- **Dual-fire + dedup:** browser-stage events fire from the Pixel AND from CAPI
  with the SAME `event_id`. Meta merges them. Never send a server-only `event_id`
  that a browser fire also used unless they are the same logical event.
- **One Pixel/Dataset** for all funnels. Trade rides on `custom_data.content_category`,
  funnel slug on `content_name`.
- **Hashing is server-side.** `hashUserData` SHA-256s normalized phone/email.
  The browser sends no PII.
- **No domain types** cross this client's signatures — translation lives in
  `meta-sync.service.ts`.

## Entry point
`metaClient.sendConversions(events, { testEventCode? })` · `metaClient.hashUserData(...)` ·
`metaClient.hashExternalId(id)`.
