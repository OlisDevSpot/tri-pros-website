# CloudTalk API Research

> **Source:** prior research session, 2026-05-23. Foundational reference for `providers/cloudtalk/client.ts` design.
> **Status:** living doc — keep updated as we discover CloudTalk API behavior beyond what's documented (e.g., webhook IP ranges, undocumented limits, real-world rate-limit handling, Conversation Intelligence envelope shape).
> **Referenced by:** [EPIC.md](./EPIC.md), [phase-0-cloudtalk-setup.md](./phase-0-cloudtalk-setup.md), [../voip/INTEGRATION-SEAM.md](../voip/INTEGRATION-SEAM.md)

---

## TL;DR

CloudTalk has **no official SDK in any language**. They publish an OpenAPI 3.0.1 spec, so the plan is to generate a typed TypeScript client from it using `@hey-api/openapi-ts` rather than hand-rolling HTTP calls.

The generated client + a thin wrapper at `providers/cloudtalk/client.ts` (auth, envelope unwrap, rate-limit handling) is the **DAL-equivalent** for CloudTalk's API — all business logic in `services/voip/campaigns/` talks through it.

## API Basics

- **Base URL:** `https://my.cloudtalk.io/api`
- **OpenAPI spec URL:** `https://developers.cloudtalk.io/swagger.json` (OpenAPI 3.0.1, v1.7)
- **Auth:** HTTP Basic — Access Key ID as username, Access Key Secret as password. Generated in dashboard under **Account → Settings → API keys**. Single account-wide credential, no OAuth, no scoped tokens. **Treat as high-privilege secret.**
- **Rate limit:** 60 req/min/company by default. Headers returned: `X-CloudTalkAPI-Limit`, `X-CloudTalkAPI-Remaining`, `X-CloudTalkAPI-ResetTime`. Returns 429 when exceeded. Higher limits available via support.
- **Response envelope:** Everything wrapped in `{ "responseData": ... }`. List endpoints add `itemsCount`, `pageCount`, `pageNumber`, `limit`, `data[]`. **Conversation Intelligence endpoints do NOT follow this envelope** — confirm during Phase 0.

## Quirks (must be encoded in `providers/cloudtalk/client.ts`)

- **Every path ends in `.json`** (e.g. `/agents/index.json`, `/contacts/edit/123.json`)
- **HTTP verbs are inverted from REST convention**: PUT is create, POST is update, DELETE is delete, GET is read
- **CueCard and VoiceAgent endpoints use a different host:** `https://platform-api.cloudtalk.io/api/`
- **All dates returned ISO 8601 in UTC**
- Some 3rd-party docs (e.g. Stitchflow) show incorrect endpoint paths — **trust the Swagger over secondary sources**

## Resources available (from OpenAPI tags)

- **Calls** — list, fetch, download recordings, browse history
- **Contacts** — full CRUD with filters (country, tag, industry, keyword); tags assign/unassign; attributes; notes CRUD; activities CRUD (attach arbitrary events like `order` with `external_id`/`external_url` for CRM linkage)
- **Agents** — CRUD plus groups (queues)
- **Numbers** — list and manage
- **SMS** — send and handle
- **Campaigns** — full CRUD for outbound dialer campaigns
- **Bulks** — batch up to 10 contact ops per request with `command_id` correlation. Use this to mitigate the 60/min rate limit on sync jobs.
- **Tags** — manage contact tags
- **CueCard** — push real-time UI to agents during active calls (by `CallUUID`)
- **Conversation Intelligence** — transcripts, sentiment, etc. (different response shape — confirm during Phase 0)
- **VoiceAgent** — initiate AI voice calls

## Getting data into our DB

### Webhooks: yes, but limited

- Configured in **dashboard at Account → Workflow Automations** (corrected 2026-05-31 — there is **NO centralized webhook-config page**) — NOT via API and NOT in the OpenAPI spec. Each event = one Workflow Automation (Object+Action) with a body-builder template + destination URL; all POST to the same `/api/webhooks/cloudtalk` URL.
- **5 Workflow Automations** (corrected from the earlier 6-event sketch): `call.started`, `call.answered`, `call.ended`, `call.disposition_set` (Call+Modified), `sms.received`. `call.missed` + `voicemail.received` are NOT separate WAs — they're derived inside the `call.ended` handler from `is_voicemail` + `answered_at`. We hardcode `event_type` as the first body field of each WA (CT doesn't inject it). Payloads must be FLAT. Source of truth: `src/shared/services/providers/cloudtalk/webhooks/events.ts`.
- **Not available as events:** agent lifecycle, contact lifecycle, number changes. These require polling the corresponding `index.json` endpoints on a schedule.
- **No webhook signing/HMAC is documented.** Need to secure the webhook endpoint via IP allowlist, shared-secret query param, or proxy through something like Svix. **Confirm with CloudTalk support before prod.**

### Alternative real-time mechanism: Call Flow Designer "HTTP Request" action

Fires inline during a call at specified points with full call context. Replaces the older legacy "Webhook" action. Good for mid-call enrichment (look up caller in our DB, return data to agent). **This is the voip routing mechanism** documented in [../voip/INTEGRATION-SEAM.md §1](../voip/INTEGRATION-SEAM.md).

## Recommended architecture (for the Phase 1 implementer)

1. **Real-time ingestion** — Workflow-Automation webhooks → Next.js Route Handler at `src/app/api/webhooks/cloudtalk/route.ts`. The route handler **is** the orchestrator: verifies the shared secret, parses the `event_type`, switches on it, and directly composes existing services. Under perfect separation (2026-06-04) it persists exactly two things — DNC (`complianceService.addToDnc`) and unenroll (`campaignEnrollmentService.unenroll`) — plus a cosmetic agent-notify. **No shadow `voip_calls`/`voip_messages` rows.** See `docs/codebase-conventions/webhook-routes.md`.
2. **Backfill / non-call entities** — Scheduled polling (Vercel Cron or Inngest) hitting list endpoints with pagination via `providers/cloudtalk/*.list()`
3. **Outbound writes** — Generated typed client used from `services/voip/campaigns/*`
4. **Mid-call enrichment (voip routing)** — Call Flow Designer HTTP Request action calling into our app's `voip-routing.service.ts` endpoints (lives in voip-in-house)

## Tooling decision

- **Generator:** `@hey-api/openapi-ts` — actively maintained, used by Vercel/PayPal, produces clean TypeScript SDKs.
- **Alternative considered:** `@openapitools/openapi-generator-cli` with `typescript-fetch` — heavier, more battle-tested, but worse DX.
- **Decision:** `@hey-api/openapi-ts` for v1; reconsider if generator output proves unstable.

## Phase 1 kickoff outline (when ready to scaffold the client)

For the implementer:

1. Add `@hey-api/openapi-ts` as a dev dependency + config file pointing at the spec URL
2. Generate client into `src/shared/services/providers/cloudtalk/generated/`
3. Create thin wrapper at `src/shared/services/providers/cloudtalk/client.ts` that:
   - Injects HTTP Basic auth from env vars (`CLOUDTALK_ACCESS_KEY_ID`, `CLOUDTALK_ACCESS_KEY_SECRET`)
   - Switches base URL between `my.cloudtalk.io/api` and `platform-api.cloudtalk.io/api/` per endpoint
   - Unwraps the `responseData` envelope (except Conversation Intelligence)
   - Handles 429 with exponential backoff respecting `X-CloudTalkAPI-ResetTime`
   - Logs `X-CloudTalkAPI-Remaining` to a metrics sink for capacity monitoring
4. Add webhook Route Handler skeleton at `src/app/api/webhooks/cloudtalk/route.ts` (per `docs/codebase-conventions/webhook-routes.md` — one URL per external source, switch on event-type in the route handler itself, no wrapper service) with TypeScript types for the 6 documented events
5. **Encode the quirks in code comments where relevant:**
   - Rate limit (60/min)
   - Inverted verbs (PUT=create, POST=update, DELETE=delete, GET=read)
   - `.json` path suffix
   - Dual hosts (CueCard/VoiceAgent → `platform-api.cloudtalk.io`)
   - No HMAC — secret-secured + IP-allowlisted webhook endpoint

## Env vars (Phase 0 sets, Phase 1 consumes)

```bash
# CloudTalk credentials (HTTP Basic — ID is username, Secret is password)
CLOUDTALK_ACCESS_KEY_ID=...
CLOUDTALK_ACCESS_KEY_SECRET=...
# Webhook integrity check (CloudTalk has no HMAC signing) — long random; rotate quarterly
CLOUDTALK_WEBHOOK_SECRET=...
# Optional Vercel-edge allowlist if CloudTalk publishes static IPs
CLOUDTALK_WEBHOOK_IP_ALLOWLIST=...
# Shared VoIP umbrella
VOIP_WEBHOOK_BASE_URL=https://voip.triprosremodeling.com
# Phase 0 only — mocked transfer-target endpoint returns this E.164 for the smoke test
CLOUDTALK_PHASE0_TRANSFER_TARGET_E164=
```

## Open questions (to resolve during Phase 0 dashboard work)

- Webhook IP ranges (for allowlist)
- Custom-header support on webhooks (alternative to query-string secret)
- Conversation Intelligence webhook envelope format
- Behavior at 90% of rate-limit utilization
- AI VoiceAgent transfer mechanics (SIP REFER vs DID re-dial)
- Recording retention policy
- Per-Campaign DID assignment strategy (one Campaign per source, or shared pool?)
