# Design — Provider-boundary translator home (#248 "small" redirects)

**Date:** 2026-08-20
**Epic:** #248 (provider & service single-entrypoint boundary refactor)
**Scope of this spec:** the governing convention for where domain translators live, plus its first two applications — **gohighlevel** and **google-calendar**. Twilio is explicitly deferred.

---

## 1. Problem

Epic #248 says no external consumer may import a provider's `lib/`. But two live conventions in `service-architecture.md` say the opposite for *translators*:

- `#dependency-direction-is-one-way` blesses `internal service → provider lib/ OK (translators)`.
- `#providers-have-no-domain-types-in-signatures`: translation "lives in the provider's `lib/` translators OR in the calling sync service."

Current code relies on the `lib/` option: `providers/gohighlevel/lib/normalize-bina-lead.ts` (imported by the bina webhook route + `customer-intake.service`), and `providers/google-calendar/lib/{map-to-gcal,map-from-gcal,conflict}.ts` (imported by `scheduling.service`). A domain type — `IntakeCore` — is even *defined inside* the gohighlevel provider lib.

The two positions cannot both hold. Owner decision (2026-08-20): enforce the strict #248 side.

## 2. The convention (governing rule)

> **Domain translation and domain policy do not live in a provider's `lib/`.**
> A provider's `lib/` is strictly **provider-internal** — only the provider's own `client.ts` imports it (config, token caches, internal helpers). Anything that (a) returns or consumes app-domain types, or (b) encodes app/business policy, lives in **domain-land**: the owning **entity** (`entities/<x>/lib`, `entities/<x>/schemas`) or a **service** (`services/<x>.service.ts` or a `services/<x>/` dir).
>
> External consumers import a provider's **`client.ts`** (actions) and **`types.ts`** (type-only, low-severity exception). Never `lib/`, `dal/`, `schemas/`, `constants/`, `webhooks/`.
>
> A **translator/adapter** (vendor payload → domain shape) is domain-land code that may import the provider's **`types.ts`** type-only for its input signature, and imports the domain shapes it produces from the owning entity.

This **supersedes** the two `service-architecture.md` clauses above. Provider `lib/` reverts to its `provider-directory-shape` definition: "only pure-local helpers that are NOT actions and are used internally by the client."

### Constraints that must not break (compiled from service-architecture.md + #248)
1. `the-deciding-question` — HTTP → provider; orchestration → service; pure-local → shared lib.
2. `client-is-the-superset-entry-point` — one `<provider>Client`; every action is a method; `types.ts`/`schemas/`/`webhooks/` are allowed sibling exports; `lib/` is not an action surface.
3. `providers-have-no-domain-types-in-signatures` — the client speaks provider-native types only; never returns `IntakeCore`/`LeadMeta`. (Reference impl note updated: translators move to domain-land, not provider lib.)
4. `dependency-direction-is-one-way` — provider never imports another provider, a service, or the DAL. (Amended: drop the "→ provider lib translators OK" line.)
5. #248 exceptions preserved: `lib/config.ts` (server-env), type-only imports, client-side hooks as a separate entrypoint.

## 3. Application A — gohighlevel

Context: the `gohighlevel` provider is shared GoHighLevel platform infra. "Bina" is a white-label marketing agency built on GHL (no own infra) — one of potentially several GHL-based lead sources we differentiate. `normalizeBinaLead` is a Bina-source→customer-intake **translator**, not a service op. `customerIntakeService.ingestLead(ctx, {core, leadMeta, note, meeting})` already exists and is already source-agnostic.

Changes:
1. **Move `IntakeCore`** out of `providers/gohighlevel/lib/normalize-bina-lead.ts` → `entities/customers/schemas/index.ts` (next to `LeadMeta`). It is the intake contract, a customers-domain shape.
2. **Move the translator** → `entities/customers/lib/lead-adapters/bina.ts`. Keep the exported name `normalizeBinaLead` (minimize churn) + the GHL `ghlString` null-coercion helper it uses (private to this file). Imports:
   - `BinaContactPayload` **type-only** from `providers/gohighlevel/types` (allowed).
   - `IntakeCore`, `LeadMeta` from `customers/schemas`; `buildLeadNote` from `customers/lib/build-lead-note` (same entity).
3. **Repoint consumers:**
   - `app/api/webhooks/bina/route.ts` — import the adapter from `customers/lib/lead-adapters/bina`, not the provider lib. Flow stays `client.verifyWebhookSecret → client.parseBinaWebhook → adapter → customerIntakeService.ingestLead`.
   - `customer-intake.service.ts` — import `IntakeCore` from `customers/schemas` (its own domain), not the provider lib.
4. **Delete confirmed-dead gohighlevel code** (audit #253-A, zero consumers): `ghl{Contact,Task,Invoice,Other}EventTypes` in `constants.ts`; the `Ghl{Contact,Appointment,Opportunity,Note,Generic,Webhook}Payload` types + `GhlEventType` in `types.ts`; backing `ghl*PayloadSchema` in `schemas.ts`. Keep only the `BinaContactPayload`/`binaContactPayloadSchema` the client uses.
5. **Result:** `providers/gohighlevel/lib/` is empty → deleted. Provider = `client.ts` + `types.ts` + `constants.ts` + `schemas.ts` (leaf).

## 4. Application B — google-calendar

Context: `scheduling.service.ts` is a single file and the sole consumer of 3 provider-lib modules that carry domain types + sync policy: `map-to-gcal` (consumes `MeetingForGCal`/`ActivityForGCal`, bakes in TPR-branded descriptions, deep-links, colors), `map-from-gcal` (returns `LocalEventUpsert`), `conflict` (last-write-wins policy). None can be leaf-client methods.

Changes:
1. **Create `services/scheduling/` dir** (matches the existing `services/media/` + `services/voip/` dir-with-internals pattern). Move `scheduling.service.ts` into it.
2. **Move the 3 transforms** in as co-located service-owned siblings: `event-to-gcal.ts` (was `map-to-gcal`), `gcal-to-event.ts` (was `map-from-gcal`), `conflict.ts`. The provider-native SDK types they reference (`GCalEvent`, `GCalEventInput`, `LocalEventUpsert`) are imported **type-only** from `providers/google-calendar/types` (allowed).
3. **Move the domain input shapes** off the provider lib:
   - `MeetingForGCal` → co-locate with its DAL producer `entities/meetings/dal/server/google-calendar.ts` (`getMeetingForGCal` returns it). The `event-to-gcal.ts` mapper imports it from there (type-only).
   - `ActivityForGCal` → it is only the `activityToGCalEvent` mapper's input contract with no separate DAL producer, so co-locate it in `services/scheduling/event-to-gcal.ts` next to the mapper (move to the activities entity only if a DAL later produces it).
4. **`googleCalendarClient` stays a pure GCal API wrapper.** `providers/google-calendar/lib/` is deleted.
5. **Repoint** the 9 `scheduling.service` importers (5 upstash jobs, 3 routers, 1 webhook route) to `services/scheduling/scheduling.service`. Mechanical path change only.

## 5. Doc amendments (same change)
- `service-architecture.md#dependency-direction-is-one-way` — remove the `internal service → provider lib/ OK (translators)` line; note translators live in domain-land.
- `service-architecture.md#providers-have-no-domain-types-in-signatures` — drop the "…OR in the provider's `lib/` translators" option; translators live in the entity/service.
- Seed `docs/codebase-conventions/provider-boundaries.md` (the #255 doc) with §2's rule now, so it's canonical before the ESLint rule lands. (Full #255 doc + lint rule remain a later, separate task.)

## 6. Out of scope / deferred
- **Twilio** — `validatePhoneLine` is a mislocated cross-provider service (orchestrates Upstash ceiling + Twilio lookup + domain policy gate), not a client method; `VOIP_DEV_OVERRIDE_NUMBER`/`getVetting` are voip-domain constants. Its correct fix (extract `phone-validation.service`, relocate voip constants) is medium-sized AND collides with the concurrent voip session's files (`funnels.router`, `voip-*.service.ts`). Deferred to its own pass.
- **Website-form + funnel translators** (`landing.router` inline builders; `domains/funnels/lib/build-funnel-lead-note`) — also belong in domain-land, but are already out of provider `lib/`. Migrate to the `lead-adapters/` home opportunistically later; not required for #248 compliance.
- **#255 ESLint rule** — lands last, after all redirects.

## 7. Sequencing & concurrent-session safety
- Per change: `pnpm tsc` clean, `pnpm lint` clean (pre-existing non-provider warnings OK). Commit gohighlevel and google-calendar as **separate** commits (small verifiable units), directly on `main` (owner-authorized epic mode).
- **gohighlevel goes FIRST** — fully safe: touches only the bina webhook route + customers entity; zero overlap with the concurrent session's areas (voip, funnels, media, google-drive).
- **google-calendar is HELD** — the concurrent session created `providers/google-drive/token.service.ts` (uncommitted, 2026-08-20) and is rerouting `googleDriveClient.refreshAccessToken` callers onto it. `scheduling.service.ts:57` is such a caller, so that file is in their blast radius. Moving `scheduling.service.ts` into a new dir while they edit it would conflict. Do google-calendar only after their google-drive token refactor lands on `main` (re-check `git log`/status first).
- Touch ONLY the files listed for the active application; never stage another session's files.

## 8. Observations logged for later (not in scope)
- The concurrent session's `providers/google-drive/token.service.ts` places a `*.service.ts` **inside** a provider dir — a tier violation per `the-deciding-question` (services live in `services/`). Flag when that work settles; do not touch now.
