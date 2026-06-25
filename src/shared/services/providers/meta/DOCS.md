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

## Test vs live data isolation

**The rule: non-production never pollutes the live pixel's optimization.** The two
legs reach it through different inputs but encode one question — *"is this real
production?"* This is intentional, not accidental:

- **Browser Pixel → host gate.** The funnel layout mounts `<PixelLoader>` only when
  `isProductionHost(host)` is true (`src/shared/config/is-production-host.ts`, derived
  from `APP_HOSTS.prod`). Off-prod (`*.localhost`, the ngrok tunnel, `*.vercel.app`
  previews) the loader never runs, `window.fbq` is never defined, and every
  `firePixel()` no-ops. **Gate is host, not `NODE_ENV`** — `process.env.NODE_ENV` is
  `'production'` on Vercel preview builds too, so it can't tell preview from prod.
  There is **no browser `test_event_code`** (CAPI-only), so *silence* is the only
  lever — you cannot route browser events to Test Events from code.
- **Server CAPI → `test_event_code`.** CAPI always sends, but non-prod carries
  `META_TEST_EVENT_CODE` → Events Manager → **Test Events** (excluded from
  optimization + reporting). Prod carries none: `server-env.ts` **hard-fails boot**
  if the code is set with `NODE_ENV=production`, so a stray code can't silently
  divert real Leads out of optimization.

**Why prevention, not cleanup:** events that land in the live dataset can't be
deleted per-event — they age out over ~30–180 days. The gate is the only real
control. "Clear Activity" in Test Events only clears the *test* view.

### Backstop — Traffic Permissions allow-list (manual, one-time)

Defense-in-depth against a misconfigured deploy firing the pixel from a non-prod
host: Events Manager → Data Sources → **the dataset** → Settings → **Traffic
Permissions** → create an **Allow List** containing only `triprosremodeling.com`
(covers all funnel subdomains). Meta then **drops** any event whose origin domain
isn't allow-listed — so a stray `*.vercel.app` preview fire is rejected at
ingestion. Caveat: it filters by *domain*, so it can't distinguish `localhost`
(which can't reach Meta anyway) and may false-block legitimate iframe/redirect
origins — verify after enabling.

### Browser QA loop — verify the live pixel without polluting

To watch real browser events fire (e.g. confirm dedup): Events Manager → **Test
Events** → enter the funnel URL → **"Open Website."** Meta binds *that* browser
session to the Test Events panel (session-scoped, **not automatable**); pair with
the **Meta Pixel Helper** extension. Browser + CAPI events show side-by-side there
so you can confirm they share one `event_id`. This is the only supported way to
exercise the browser pixel against real infrastructure off-prod.

> **Not doing — separate "test pixel" per environment.** The dual-fire + dedup
> design shares one `event_id` across Pixel and CAPI; pointing the browser at a
> test pixel while CAPI keeps the prod dataset would split the pair across two
> datasets and silently break dedup. Browser silence + CAPI Test Events isolates
> cleanly without that risk.
