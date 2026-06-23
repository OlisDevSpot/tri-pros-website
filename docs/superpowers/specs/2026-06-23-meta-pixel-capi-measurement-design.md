# Meta Pixel + CAPI Measurement Loop — Design Spec

**Date:** 2026-06-23
**Status:** Approved design — ready for implementation plan
**Relates to:** [Showcase Funnel System spec](2026-06-17-showcase-funnel-system-design.md) §6 (this is the build-out of that deferred "Plan 3" / "Phase 2.5"), `docs/plans/meta-ads-compound-intelligence.md` (legacy program context), `docs/codebase-conventions/service-architecture.md` + ADR-0003 (tier rules).

This spec extends the Showcase Funnel plan with the measurement layer that relays funnel conversions back to Meta — browser **Pixel** + server **Conversions API (CAPI)** — implemented as a first-class provider on the four-tier backend architecture, designed to scale to ~100 funnels with zero per-funnel wiring.

---

## 0. Starting point (as of 2026-06-23)

- The kitchen funnel is feature-complete end-to-end (landing → multi-step → lead persists to CRM → enrichment → confirmation). Bathroom/interior are config-only follow-ons (out of scope here).
- **Nothing pixel/CAPI is implemented.** `grep` for `fbq`/CAPI finds only content constants. `FunnelSpec.pixel.contentCategory` is declared but never fired.
- The only Meta asset that exists is the company's **Meta Business page** (ads/creatives ready). No Pixel/Dataset, no CAPI token yet.
- Existing runtime helpers already in place and reused: `useFunnelUtm` (captures `utm_*` / `fbclid` / `gclid` into `leadMetaJSON`); lead-first model (the `Lead` moment is one clean point in `pii-form-step.tsx`); `scripts/meta/lib/client.ts` is the **ads-management CLI** Graph client (separate concern from the runtime CAPI provider this spec introduces).

---

## 1. Goals & non-goals

**Goals**
- Relay funnel + pipeline conversions to Meta correctly from Facebook's perspective (dual-fire + dedup, advanced matching, value-based bottom-funnel).
- One implementation that scales to ~100 Tri Pros funnels with **zero Meta wiring per funnel**.
- Sit on the documented four-tier architecture (provider → sync → internal service → DAL) with QStash durability — indistinguishable in shape from Twilio/Zoho.
- Preserve developer experience: a new funnel fires the full event suite just by existing.

**Non-goals**
- Multi-tenant / multi-business pixel support. All 100 funnels are Tri Pros — one business, one Meta page, one ad account, **one Pixel/Dataset**.
- Google Tag Manager / server-side GTM / CAPI Gateway. Direct in-code integration only.
- A/B experiment ledger, CMS-editable event config.
- The legacy Equity Reset / StormGuard programs (coexist, out of scope).

---

## 2. Decisions locked in brainstorming

| # | Decision | Rationale |
|---|---|---|
| 1 | **One shared Pixel/Dataset** for all funnels; trade as `content_category`, funnel slug as `content_name`. | Pooled conversion volume keeps the pixel out of permanent learning-phase starvation at a constrained budget. Audiences/lookalikes still segment on the trade param. |
| 2 | **Dual-fire + dedup**: browser Pixel + server CAPI per browser-stage event, same `event_id`. | ~95% signal capture vs ~60% browser-only; server half immune to iOS/ad-blockers and carries hashed PII. |
| 3 | **Design the whole loop, build the funnel-half first.** | Coherent design; value fast at lower risk. CRM-half is a specced phase 2. |
| 4 | **Convention-first DX**: the engine auto-fires the standard suite from lifecycle moments it owns. Thin per-step override hatch only. | Only way 100 funnels stay consistent; matches the existing "defaults-with-override" principle. |
| 5 | **Fire on submit, disclose in Privacy Policy.** Browser carries no PII; server carries hashed PII. TCPA stays scoped to call/SMS. | Industry-standard, signal-maximizing, compliant for a CA home-services funnel. |
| 6 | **Meta is a provider** scaffolded identically to Twilio/Zoho. | User directive; uniformity = pattern-matchable, swappable, testable. |

---

## 3. Topology & mental model

**Two pipes, two jobs:**

| | Pixel (browser) | CAPI (server) |
|---|---|---|
| Runs from | visitor browser (`fbq`) | Next.js server (HTTPS POST to Graph API) |
| Contributes | attribution signals: `_fbc`, `_fbp`, IP, UA (auto-collected) | identity signals: hashed phone (+ `external_id`, replayed `_fbc`/`_fbp`) |
| Weakness | ~35% lost to blockers/iOS | no automatic browser signals |

**The merge is the point.** Browser and server send the same event with the same `event_id`; Meta collapses them into one event and **unions the `user_data` from both halves**. The deduplicated event therefore holds click-attribution (browser) *and* identity match (server) — more complete than either alone, and resilient to browser-side signal loss. Browser PII is therefore redundant and deliberately omitted (cleaner consent posture; server-side advanced matching is Meta-recommended and unblockable).

**Single pixel, parameterized:** every event carries `content_category` (trade) + `content_name` (funnel slug) so 100 funnels stay individually reportable within one dataset.

**Ownership:** Oliver creates the Pixel/Dataset + CAPI token in Events Manager (one-time, §8). The codebase owns everything that sends events to it.

---

## 4. Architecture — tier mapping

Meta slots into the four-tier backend split (`docs/codebase-conventions/service-architecture.md`). Shapes mirror `services/providers/twilio/`.

### 4.1 Provider (server-only HTTP) — `src/shared/services/providers/meta/`

```
services/providers/meta/
  DOCS.md            usage rules + the dual-fire/dedup invariant
  client.ts          metaClient singleton — THE entry point. Methods:
                       · sendConversions(events)  → POST graph.facebook.com/<version>/<datasetId>/events
                       · hashUserData({ phone, email })  → SHA-256 of normalized values (advanced matching)
  constants/index.ts Graph API version, base URL, standard event-name constants
  schemas/
    primitives.ts    hashed-id, unix-timestamp, action_source
    server-event.ts  Zod for the CAPI payload WE send (event_name, event_time, event_id, user_data, custom_data)
  lib/config.ts      createProviderConfig({ provider: 'meta', ... }) — META_CAPI_TOKEN, META_DATASET_ID,
                       NEXT_PUBLIC_META_PIXEL_ID. All .optional() → boot resilient.
```

- Per `client-is-the-superset-entry-point`, **`hashUserData` is a client method**, not a `lib/` file (it's a Meta-ecosystem helper, like twilio's `verifyWebhookSignature`).
- No `webhooks/` — Meta does not call us for CAPI.
- Per `providers-have-no-domain-types-in-signatures`, the provider speaks raw CAPI shapes only — it knows nothing about `Customer`/`Proposal`.

### 4.2 Sync service (ACL / translation) — `src/shared/services/meta-sync.service.ts`

Qualifies under `sync-service-when-2-plus-ops` (many event types). Wraps `metaClient` in **domain operations** — `trackLead`, `trackSchedule`, `trackContact`, `trackMeetingComplete`, `trackProposalSent`, `trackPurchase` — and owns the translation **domain-event → CAPI payload** (assembles `user_data` via `metaClient.hashUserData`, builds `custom_data`). Receives already-resolved native data; **touches no DB**.

### 4.3 Internal service (orchestrator) — `src/shared/services/measurement.service.ts`

Receives `ScopedContext`, performs any DAL reads needed (e.g. fetch a customer's hashed-phone inputs, read a proposal's final TCP for `Purchase` value), assembles the domain-event description, hands off to `meta-sync`. **Only tier that touches the DAL** (`services-never-import-db`: it forwards `ScopedContext` to DAL, never imports `db`). The existing `analyticsService` stub (engagement scoring/digests) stays separate — not overloaded.

### 4.4 Durability — QStash job — `services/providers/upstash/jobs/meta-capi-event.ts`

Every **server-side** CAPI fire dispatches through this job (`background-side-effects-via-qstash-jobs` — Vercel kills bare `void fetch().catch()`). Criticality is "cosmetic" (a dropped event degrades optimization, it is not a data-integrity bug) → **`void metaCapiEventJob.dispatch(...)`**. QStash still gives durable enqueue + retries. Handler is idempotent (Meta dedupes on `event_id`).

### 4.5 Client-side browser Pixel (NOT a provider) — `src/shared/domains/funnels/lib/tracking/`

Providers are server-only, so the `fbq` surface lives in the funnels domain:
- a **one-time script loader** mounted in `src/app/(frontend)/funnels/layout.tsx` (replaces the existing "Plan 3" placeholder comment),
- a typed **`firePixel(event, params)`** wrapper (nobody touches raw `fbq`),
- the **convention emitter hook** (`useFunnelTracking`, §5).

### 4.6 End-to-end flow (Lead)

```
PII submit (browser)
  ├─ firePixel('Lead', { eventId, contentCategory, contentName })          ← browser pipe
  └─ submitLead tRPC mutation (existing; gains an `eventId` input)
        → persist lead (DAL)                                                ← never blocked (resilience invariant)
        → persist attribution bundle { fbp, fbc, external_id: customerId }  ← §6.3, phase-1 critical
        → void metaCapiEventJob.dispatch({ event:'Lead', eventId, customerId })   ← server pipe, durable
              → measurement.service.trackLead → meta-sync → metaClient.sendConversions
```

Same `eventId` on both pipes → one deduplicated Lead → ~95% capture.

---

## 5. The convention emitter (zero per-funnel wiring)

**Core rule: events bind to step *kinds* and lifecycle moments — never to step IDs.** A funnel fires exactly the events its building blocks imply, automatically.

**Convention map (engine-owned, not per-funnel):**

| Lifecycle moment the engine already owns | Event | Browser | Server CAPI twin |
|---|---|---|---|
| Funnel mounts | `PageView` | ✓ | — |
| First answer on any step (once) | `ViewContent` (+ `content_category`) | ✓ | — |
| A `pii-form` step completes → lead created | `Lead` | ✓ | ✓ (dedup) |
| A `datetime` step completes *(if present)* | `Schedule` | ✓ | ✓ (dedup) |
| Terminal `confirmation` reached / enrich done | `CompleteRegistration` | ✓ | — |

**`Schedule` is dormant by design.** ⚠️ The as-built kitchen funnel has **no `datetime`/appointment step** (its step kinds are `card-select`, `zip`, `pii-form`, `address`, `confirmation`; `timeline` is a `card-select` *intent* signal, not a booked time). This diverges from the Showcase spec §6.3 wording ("appointment time selected → Schedule"). Because the emitter binds `Schedule` to the `datetime` **kind**, it simply never fires until a funnel includes that step — no dead code, no special-casing. Doc-vs-build divergence noted for the Showcase spec; no backfill needed.

**Emitter API** — `useFunnelTracking(ctx)`, wired into `use-funnel-engine`, living in `funnels/lib/tracking/`. Internally:
- a **fired-once guard** (Set in session state) so `PageView`/`ViewContent` fire once and back-navigation never re-fires `Lead`;
- reads each completed step's **kind**, looks up the convention map;
- auto-attaches `content_category` (trade) + `content_name` (funnel slug) to every event.

A funnel author writes nothing — they already declare `pixel.contentCategory`.

**`event_id` threading:**
- Browser-only events (`PageView`, `ViewContent`, `CompleteRegistration`): mint `event_id`, fire pixel, done.
- Dual-fire events (`Lead`, `Schedule`): **browser mints the `event_id`**, fires the pixel, and **passes that id into the server call**. `Lead` reuses the existing `submitLead` mutation (add `eventId` input). `Schedule` (and any future twin) uses one small guarded mutation `funnelsRouter.trackFunnelEvent({ leadId, event, eventId })` that dispatches the CAPI job. Server reuses the received id → Meta dedupes.

**PII handling:** browser pixel carries **no PII** (Meta auto-collects `_fbp`/`_fbc` only); server CAPI carries the hashed phone (already on the lead). All PII hashing is server-side.

**Escape hatch (thin):** a step's content may carry optional `track?: { event: string, custom?: Record<string, unknown> }` to emit a custom/extra event on completion. The only per-funnel knob; ~95% of funnels never use it.

---

## 6. The CRM-half (Contact → Purchase) — designed now, built phase 2

Server-only events fired from existing pipeline transitions. This half teaches Meta to optimize for contract-signers, not form-fillers.

### 6.1 Event → transition map

| Meta event | Type | Fires from | Trigger |
|---|---|---|---|
| `Contact` | standard | lead/customer status transition | lead first contacted (new → contacted) |
| `MeetingComplete` | **custom** | `meetingServerSpec.hooks.update.after` | meeting outcome → completed |
| `ProposalSent` | **custom** | proposal status transition | proposal → sent |
| `Purchase` (+ `value`) | standard | contract signed (Zoho-sign webhook / converted-to-project) | the gold event |

Firing mechanism mirrors the **existing GCal sync**: `meetingServerSpec.hooks.update.after` already dispatches `syncMeetingToGcalJob`; add a sibling `void metaCapiEventJob.dispatch(...)`. Proposal and contract transitions get the same treatment. No new infrastructure pattern.

### 6.2 `Purchase` value

`measurement.service` reads the proposal's derived **final TCP** (existing final-tcp helper) via DAL; sends `value` + `currency: 'USD'`. Unlocks ROAS / value-based optimization and value-weighted lookalikes.

### 6.3 Attribution carry-forward — **PLANTED IN PHASE 1**

By the time a contract signs (weeks later) the browser, `_fbp`, and `_fbc` are gone, so downstream events must **replay** them. At lead creation, persist an attribution bundle onto the customer (extending `leadMetaJSON`, which already holds `utm`/`fbclid`):

```
{ fbp, fbc, external_id: customerId }
```

Every event — funnel `Lead` and every CRM event — carries `external_id: customerId` (hashed) + stored `fbp`/`fbc` + hashed phone. The stable `external_id` stitches the entire journey (click → lead → meeting → purchase) to one person across months. **Phase 1 must persist this bundle even though phase 2 consumes it**, to avoid a painful backfill.

### 6.4 Idempotency

Server events have no browser twin → mint a **deterministic** `event_id` per transition (`purchase:<contractId>`, `meetingcomplete:<meetingId>`). QStash retries re-send the same id; Meta dedupes; no double-counting.

### 6.5 Standard vs custom

`Lead`/`Schedule`/`Contact`/`Purchase`/`CompleteRegistration` are standard Meta events (best out-of-box optimization). `MeetingComplete`/`ProposalSent` have no standard equivalent → custom events (usable for custom conversions + funnel-truth reporting).

---

## 7. Configuration

Via `createProviderConfig` in `providers/meta/lib/config.ts`; all fields `.optional()` so boot never breaks when unconfigured.

```
NEXT_PUBLIC_META_PIXEL_ID   # public — browser fbq init
META_DATASET_ID             # = pixel ID — server CAPI endpoint target
META_CAPI_TOKEN             # server-only — never ships to browser
```

The existing `META_ACCESS_TOKEN` (ads CLI, `scripts/meta`) is untouched — different token, different job.

**Environment gating:** config absent → the integration **no-ops** (local dev fires nothing automatically). Staging/QA fires with Meta's **`test_event_code`** so test traffic stays in the Test Events panel and never contaminates optimization data. Production fires for real.

---

## 8. Setup, testing & verification

**One-time, in Meta Events Manager (Oliver):**
1. Create a **Pixel / Dataset** under the Business → note the **Pixel ID**.
2. Dataset → Conversions API → **generate access token**.
3. *(Recommended, can lag)* **Verify domain** `triprosremodeling.com` (Brand Safety → Domains) — required for iOS Aggregated Event Measurement attribution.

**Verification (acceptance signals):**
- **Test Events tool** — complete a funnel, watch `PageView → ViewContent → Lead` arrive live.
- **Deduplication** — the Lead shows **"Received from: Browser and Server"** as **one** event. Two separate Leads = broken `event_id` threading (pass/fail gate).
- **Event Match Quality (EMQ)** — server `Lead`/`Purchase` score well, proving hashed phone + `external_id` + `fbc`/`fbp` land.

---

## 9. Compliance / privacy

- **Privacy Policy** gains one line: hashed contact info is shared with advertising partners (Meta) for conversion measurement. Existing PII-step trust microcopy covers user-facing reassurance.
- **TCPA consent stays scoped to call/SMS** — unchanged, separate concern.
- No PII in the browser payload (§3, §5) keeps the client side clean.

---

## 10. Phasing

**Phase 1 (build now) — funnel-half:**
- `providers/meta/` (client + schemas + constants + config + DOCS).
- `meta-sync.service.ts` + `measurement.service.ts`.
- `meta-capi-event` QStash job + registration.
- Browser tracking lib + `firePixel` + pixel loader in `funnels/layout.tsx`.
- `useFunnelTracking` convention emitter wired into `use-funnel-engine`.
- Funnel-half events: `PageView`, `ViewContent`, `Lead` (dual-fire), `CompleteRegistration`. `Schedule` wired but dormant (no `datetime` step).
- `submitLead` gains `eventId` input + fires the server `Lead` twin.
- `funnelsRouter.trackFunnelEvent` guarded mutation (for dormant `Schedule` + future twins).
- **Attribution-bundle persistence** (`fbp`/`fbc`/`external_id`) at lead creation.
- Privacy Policy line; env config + boot banner entry.

**Phase 2 (specced, build later) — CRM-half:**
- `Contact` / `MeetingComplete` / `ProposalSent` / `Purchase` hooks on entity transitions, mirroring GCal-sync dispatch.
- Value-based `Purchase` from final TCP.

---

## 11. Open coordination items (Oliver)

- [ ] Create the shared Pixel/Dataset + CAPI access token (Events Manager).
- [ ] Verify domain `triprosremodeling.com` for iOS AEM.
- [ ] Confirm optimization cadence with whoever runs ads: start on `Lead`, graduate to `Purchase`/value once volume supports it (~50 conversions/week exits learning).

---

## 12. File-change surface (orientation for the plan)

**New:**
- `src/shared/services/providers/meta/{client.ts,types.ts,DOCS.md}`
- `src/shared/services/providers/meta/constants/index.ts`
- `src/shared/services/providers/meta/schemas/{primitives.ts,server-event.ts}`
- `src/shared/services/providers/meta/lib/config.ts`
- `src/shared/services/meta-sync.service.ts`
- `src/shared/services/measurement.service.ts`
- `src/shared/services/providers/upstash/jobs/meta-capi-event.ts`
- `src/shared/domains/funnels/lib/tracking/{loader,fire-pixel,use-funnel-tracking,convention-map}.ts(x)`

**Modified:**
- `src/app/(frontend)/funnels/layout.tsx` (mount pixel loader — replaces the Plan 3 placeholder)
- `src/shared/domains/funnels/hooks/use-funnel-engine.ts` (invoke emitter)
- `src/trpc/routers/funnels.router.ts` (`submitLead` gains `eventId`; add `trackFunnelEvent`)
- lead-creation path / `build-lead-input.ts` (persist attribution bundle)
- `src/shared/config/server-env.ts` (spread `metaEnvFragment`, register `metaConfigMeta`)
- `src/app/api/qstash-jobs/route.ts` (register `meta-capi-event`)
- Privacy Policy page
- Phase 2: `meetingServerSpec` / proposal / contract hooks
```
