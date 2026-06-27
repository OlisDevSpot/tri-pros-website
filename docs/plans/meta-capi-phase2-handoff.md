# Handoff: Meta CAPI Phase 2 — down-funnel conversion feedback

> Paste this whole file as the opening prompt for a fresh session. It is the
> brief + reasoning + guardrails. Do **not** start coding from it — first run the
> `writing-plans` skill to produce a step plan, get it approved, then execute.

---

## The one-sentence goal

Feed Tri Pros' **down-funnel CRM conversions** (appointment booked, meeting held,
proposal sent, contract signed) back to Meta via the Conversions API, so the ad
algorithm optimizes for **customers**, not form-fills.

## Why this matters (read this — it's the whole point)

Today Meta receives exactly one conversion signal: `Lead` (someone submitted the
PII step). That means Meta can only learn to find **the cheapest people who fill
out a form** — which drifts toward low-intent tire-kickers, because Meta has zero
visibility into which leads ever booked, showed up, or signed.

> You cannot bid your way to lead *quality* while the only signal is a form-fill.
> Quality optimization is impossible until down-funnel events flow back.

At a real ad budget this is the difference between paying for 200 junk leads and
paying for 60 leads that actually become appointments. This phase is the highest-
leverage measurement work remaining.

## The locked strategic decision (do not re-litigate)

**Optimize "Both, phased":** ship ALL down-funnel events for *measurement* first,
then move ad-set optimization from `Lead` → **`MeetingComplete`** (higher volume,
faster learning than waiting on signed contracts) → graduate to **`Purchase`**
(with `value` + `currency` for true ROAS bidding) once volume supports it.

## Event mapping (CRM → Meta)

| CRM moment | Meta event | action_source | value? |
|---|---|---|---|
| Lead called / first contact | `Contact` | `phone_call` | no |
| Appointment booked | `Schedule` | `system_generated` | no |
| Meeting completed | `MeetingComplete` (custom) | `system_generated` | optional est. |
| Proposal sent | `ProposalSent` (custom) | `system_generated` | optional est. |
| Contract signed | `Purchase` | `system_generated` | **yes — TCP + USD** |

All five names already exist in `META_EVENT` (`providers/meta/constants/index.ts`).
`META_ACTION_SOURCE.systemGenerated` already exists. `value`/`currency` are already
allowed in `metaCustomDataSchema`.

## What's already built (Phase 1) — you are EXTENDING, not starting

The 4-tier provider architecture and the extension seams are in place:

- **Provider** `src/shared/services/providers/meta/` — `metaClient.sendConversions()`,
  `metaClient.hashUserData()` (ph/em/fn/ln/ct/st/zp/country, single-source
  normalization), `hashExternalId()`. No domain types cross this boundary.
- **`meta-sync.service.ts`** — `trackLead(args)` builds the CAPI wire shape from
  `LeadEventArgs` and calls the client. **Generalize this**: extract a private
  `trackEvent(eventName, args)` and make `trackLead` a thin caller, then add
  `trackContact` / `trackSchedule` / `trackMeetingComplete` / `trackProposalSent`
  / `trackPurchase`.
- **`measurement.service.ts`** — currently only `trackFunnelLead` (forwards
  straight to meta-sync because the Lead has all data in hand). **This is where
  Phase 2 grows**: each new method **reads the entity via DAL** (Customer/Meeting/
  Proposal) to assemble `user_data` (+ `value`/`currency` for Purchase), then calls
  the matching meta-sync method. (Per its own header comment.)
- **`meta-capi-event` QStash job** (`providers/upstash/jobs/meta-capi-event.ts`) —
  discriminated payload `{ event: 'Lead', args }`. **Extend the union** with the new
  variants; the handler routes each to its measurement method.
- **Router seam** `funnelsRouter.trackFunnelEvent` (`funnels.router.ts`) — already
  guarded by `leadId` UUID + rate-limited; currently accepts only `'Schedule'` and
  no-ops. This is the entry point for funnel-stage post-lead events.

## Architecture rules (mirror these exactly)

1. **Fire from the entity hook, not the router.** CRM events trigger from the
   owning entity's server spec hooks — `meetingServerSpec.hooks.update.after`
   (status→completed ⇒ MeetingComplete; appointment set ⇒ Schedule), proposal/
   contract transitions (ProposalSent, Purchase). Mirrors `entity-owns-its-mutations`.
2. **Cosmetic criticality.** Always `void metaCapiEventJob.dispatch(...)`. A dropped
   Meta event degrades optimization but is NOT a data bug — it must never block or
   fail the CRM mutation.
3. **Idempotent handlers + stable `event_id`.** These are server-only events (no
   browser twin), so derive a deterministic id like `` `${event}:${entityId}` ``
   (e.g. `MeetingComplete:<meetingId>`). QStash retries then dedupe at Meta instead
   of double-counting.
4. **Rebuild `user_data` from the lead Customer.** ph/ct/st/zp + `external_id`
   (customer.id) + `fbp`/`fbc` from `leadMetaJSON.source.meta` (+ `deriveFbc` from
   the persisted `fbclid`). Reuse `metaClient.hashUserData`.
   - **Name caveat:** the customer row stores a single `name`; the Lead path passes
     `firstName`/`lastName` separately to avoid lossy splitting. Either (a) persist
     `firstName`/`lastName` on the customer at ingest (small schema add — benefits
     every down-funnel event's match quality), or (b) anchor on `ph` + `external_id`
     and omit `fn`/`ln`. Recommend (a).
5. **`value`/`currency` for Purchase.** Pull the deal value (proposal final TCP /
   signed contract amount), `currency: 'USD'`. This is what unlocks ROAS bidding.
6. **`event_time` = the real CRM timestamp** in unix **seconds** (Meta accepts up to
   7 days old). Provider purity, no domain types in the client, DAL reads only in
   `measurement.service`.

## Build order

**Slice 0 — `CompleteRegistration` CAPI twin (do this FIRST).**
This was scoped as a "Tier 2" quick win but correctly belongs here: it's the
minimal exercise of the generic "rebuild `user_data` from a `leadId` and fire a
non-Lead CAPI event" path — no entity hooks, no value/currency. It also closes a
real gap: today `CompleteRegistration` is **browser-only**, so it's lost on iOS/
ad-blockers and can't be optimized on. Steps:
1. `trackFunnelEvent` (router): accept `'CompleteRegistration'`; dispatch the job
   (thread `clientIp`/`user-agent`/`eventSourceUrl` from ctx) instead of no-op.
2. `meta-capi-event` job: add `CompleteRegistration` variant →
   `measurementService.trackFunnelCompleteRegistration(args)`.
3. `measurement.service`: new method DAL-reads the customer by `leadId`, builds
   `user_data`, calls a generalized `metaSyncService.trackEvent('CompleteRegistration', …)`.
4. Client: at the confirmation step, mint ONE `event_id`, `firePixel('CompleteRegistration', { eventId })`,
   and call `trackFunnelEvent({ leadId, event: 'CompleteRegistration', eventId, pixel })`
   with the SAME id. Read `leadId` from `answers.pii.leadId`. Remove `confirmation`
   from `STEP_KIND_BROWSER_EVENT` (it's now dual-fired at its own site, consistent
   with how `Lead` is handled) and update that convention-map comment.
5. Verify in Events Manager Test Events: one deduped event, EMQ ≥ 6.

**Then the CRM-half**, in volume order so optimization can start early:
`Schedule` → `MeetingComplete` → `ProposalSent` → `Contact` → `Purchase`.
Once `MeetingComplete` is flowing with volume, switch the ad-set optimization
event from `Lead` to `MeetingComplete`.

## Verification & guardrails

- **Test Events, real browser only** — never headless: Meta's BotBlocking silently
  drops automation traffic (false negatives). Use `META_TEST_EVENT_CODE` in staging;
  prod hard-fails boot if that code is set.
- Confirm each event shows the expected match keys + EMQ, and that retries dedupe.
- **Privacy:** down-funnel events also transmit hashed PII to Meta — confirm Privacy
  Policy §6 (hashed contact data shared with Meta) is broad enough to cover them.

## Prerequisite (blocks EVERYTHING — verify before testing)

Meta must be provisioned in prod: `NEXT_PUBLIC_META_PIXEL_ID`, `META_DATASET_ID`,
`META_CAPI_TOKEN` set on Vercel, domain `triprosremodeling.com` verified. If absent,
`isMetaConfigured()` is false and every CAPI call no-ops (with a prod `console.error`).

## Reference

- Spec: `docs/superpowers/specs/2026-06-23-meta-pixel-capi-measurement-design.md`
- Conventions: `docs/codebase-conventions/service-architecture.md` (background jobs,
  provider tiers), ADR-0003.
- Provider rules: `src/shared/services/providers/meta/DOCS.md`.
- Funnel measurement rules: `src/shared/domains/funnels/DOCS.md`.
