# Observability Infrastructure — Epic Design Spec

**Date:** 2026-07-30
**Status:** Design — awaiting review
**Type:** Epic (multi-phase, independently shippable)
**Driver:** We are spending real money on Meta Ads and are blind to what happens after the click — where visitors drop off in funnels, what they actually did, and whether the app is silently throwing errors that kill paid leads.

---

## 1. Purpose

Stand up **first-class observability infrastructure** for the whole codebase — not a one-off funnel tracker. The immediate use case is Meta-Ads funnel drop-off, but the thing we build is a **decoupled event-emit seam** that any action anywhere (funnels today, SEO/records/scheduling tomorrow) bolts onto with a single call.

Two design commitments, set by the product owner, govern everything below:

1. **Minimal coupling.** Call sites must never import a vendor SDK. They emit a typed event through one facade; providers (PostHog, Sentry, first-party DB) sit behind an interface and are swappable without touching a single call site.
2. **Infrastructure, not a feature.** DB schema, domain boundaries, and naming are generic. `observability_events` is not funnel-shaped. New event types are new *declarations*, never new plumbing.

## 2. Scope

- **In:** the emit seam (typed event registry + `track()` facade + provider interface/registry), a **PostHog** provider (funnel drop-off, sessions, replay, heatmaps, IP/geo), a **Sentry** provider (errors/crashes), a **first-party** provider (generic `observability_events` table + DAL), central PII sanitization, privacy-policy disclosure, and a read-side `source()` that feeds funnel drop-off into the existing analytics dashboard. Optional Vercel Web Vitals.
- **Out (future cycles):** SEO instrumentation (reuses the same seam — a later epic), folding the existing Meta Pixel/CAPI behind this seam (works today; do not refactor), a full cookie/consent banner (owner chose pragmatic-minimum privacy), Google Analytics 4 and Microsoft Clarity (evaluated and **rejected** — see §11).

## 3. Ground-truths (verified against code, 2026-07-30)

**What already exists**
- **G1.** Meta Pixel + CAPI are wired into the funnels: `src/shared/domains/funnels/lib/tracking/{pixel-loader.tsx,use-funnel-tracking.ts,fire-pixel.ts,convention-map.ts,lead-qualification.ts}`. Click→lead is reported *to Meta*, but the step-level data is **not queryable by us**.
- **G2.** A **read-side** business-KPI analytics framework exists: `src/shared/domains/analytics/{types.ts,resolver.ts,index.ts}` — a `source()/metric()/bucket()/resolve()` composition producing CPL, ROAS-per-creative, sales-funnel KPIs. Its own spec (`docs/superpowers/specs/2026-07-28-analytics-feature-marketing-sales-design.md`) is **Design — awaiting review**; the domain builders exist but the dashboard/buckets/sync job are not yet built. That spec **explicitly flags anonymous funnel-step instrumentation ("B4") as out-of-scope** — this epic fills that gap.
- **G3.** Every third-party integration follows one provider shape: `src/shared/services/providers/<name>/` with `client.ts`, `schemas/`, `lib/config.ts`, `constants/`, `DOCS.md`. There are 16 providers today (meta, twilio, resend, cloudtalk, …). PostHog and Sentry drop in identically.
- **G4.** Provider config is standardized via `createProviderConfig` (`src/shared/config/create-provider-config.ts`): a Zod env fragment + `requiredKeys` + `toConfig`, yielding `build/get/isConfigured/configMeta`. Server-only keys never ship to client; `isXConfigured()` gates activation. No module-scope `env.*` reads. Template: `src/shared/services/providers/meta/lib/config.ts`.
- **G5.** **No events/analytics/session table exists** in `src/shared/db/schema/` (45 files scanned). The first-party store is greenfield — we design it decoupled from day one.

**Conventions this epic must honor**
- **G6.** Layering per ADR-0003: provider → service (ACL facade, no DB) → DAL → router. DAL owns all writes (Rule 19 — services/jobs never raw `db.insert/update`).
- **G7.** jsonb governance per ADR-0005 + `docs/codebase-conventions/jsonb-columns.md`: the event `props` column is an append-only heterogeneous log — a sanctioned jsonb use; **never shallow-merge**.
- **G8.** Compile-time registry precedent: the Entity Action System (ADR-0001) — a typed, compile-time registry keyed by name. The event registry mirrors this shape.
- **G9.** Privacy stance = **pragmatic minimum** (owner decision): mask PII in replays + disclose in privacy policy; **no** consent banner in v1.
- **G10.** Budget = **free tier only** (owner decision): PostHog free (~1M events + 5k recordings/mo), Sentry free tier, Vercel Web Analytics free tier.

## 4. Architecture — the emit seam

Two halves that touch **only at the data layer**:

```
WRITE side (new: domains/observability)     READ side (exists: domains/analytics)
───────────────────────────────────────     ─────────────────────────────────────
call site                                    analytics source() ──┐
  │  track(event, payload, ctx)                                    │ reads rows
  ▼                                                                ▼
[ facade ] ── sanitize PII ──┬─→ PostHog provider          observability_events
                             ├─→ Sentry provider                 (Neon table)
                             └─→ First-party provider ──────────────┘ (writes)
```

**The spine — five small pieces:**

1. **Typed event registry** (`domains/observability/events.ts`) — `defineEvent({ name, schema })`, compile-time, mirroring the Entity Action System registry (G8). The registry is the contract. v1 events: `funnel_step_viewed`, `funnel_step_completed`, `lead_submitted`, `appointment_set`. Adding an event = one `defineEvent` — no plumbing.
2. **The facade** (`domains/observability/track.ts`) — `track(event, payload, ctx)`, with a client variant and a server variant. **Call sites import only this + an event name.** They never reference PostHog/Sentry. Swapping a provider edits the provider registry, not call sites.
3. **Provider interface + registry** (`domains/observability/providers.ts`) — a common `ObservabilityProvider` interface (`capture(event, payload, ctx)`, `isEnabled()`); a registry the facade fans out to. Concrete providers live under `src/shared/services/providers/{posthog,sentry}/` per G3/G4. Enablement is per-provider via `isXConfigured()` — missing keys ⇒ provider is dark, never an error.
4. **First-party store** — generic `observability_events` table (§7) + a DAL. Written through the first-party provider. Not funnel-specific.
5. **Central PII sanitize** — one step inside the facade, ahead of fan-out. Single enforcement point so no call site can leak a name/phone/address/email to any provider. Directly implements G9.

**Bolt-on points (how actions attach):**
- **Funnel steps** — add `track()` inside the existing `use-funnel-tracking.ts` chokepoint (it already fires the Meta pixel; step events stay in lockstep).
- **Conversions** — `track('lead_submitted' | 'appointment_set', …)` inside the *owning entity's* service mutation (G6 — the entity owns its writes).
- **Errors** — Sentry provider auto-captures unhandled errors; handled/expected errors emit explicitly via `track()`.

**Directory layout:**
```
src/shared/domains/observability/     ← NEW (write/capture)
  events.ts        (registry + defineEvent)
  track.ts         (facade: client + server)
  providers.ts     (ObservabilityProvider interface + registry)
  sanitize.ts      (PII masking)
  index.ts         (public surface)
src/shared/domains/analytics/         ← EXISTS (read/aggregate) — gains a new source() in Phase 3
src/shared/services/providers/posthog/ ← NEW (provider, per G3/G4)
src/shared/services/providers/sentry/  ← NEW (provider, per G3/G4)
src/shared/db/schema/observability-events.ts ← NEW (G5)
```

## 5. Providers (v1)

| Provider | Role | Free-tier notes |
|----------|------|-----------------|
| **PostHog** | Funnel drop-off, sessions, IP/geo, event stream, session replay + heatmaps | ~1M events + 5k recordings/mo. Reverse-proxied through a Next.js rewrite (`/ingest`) so adblockers on Meta traffic don't eat data. Input masking on by default. |
| **Sentry** | Errors/crashes, performance, release tracking | `@sentry/nextjs` (client+server+edge + `instrumentation.ts`), source maps via Vercel, tunneled to dodge adblock, email alert on new issues. |
| **First-party** | Durable, owned copy of events → feeds the analytics dashboard | Writes `observability_events` via DAL. No third-party dependency for the money dashboard. |
| **Meta** *(future)* | — | Pixel/CAPI works today; a later cycle *may* fold it behind this seam. Do not refactor now. |

## 6. Data flow

1. Action fires → `track(event, payload, ctx)`.
2. Facade validates `payload` against the event's schema (registry), then **sanitizes** PII.
3. Facade fans the sanitized event to each **enabled** provider.
4. First-party provider persists a row via DAL; PostHog/Sentry receive it over the network (proxied).
5. Read side: analytics `source()` queries `observability_events` → funnel drop-off metric in the Marketing bucket, alongside CPL/ROAS.

## 7. Data model — `observability_events`

Generic, append-only, decoupled from any one domain (G5, G7):

| Column | Type | Notes |
|--------|------|-------|
| `id` | pk | |
| `name` | text | event type from the registry (`funnel_step_completed`, …) |
| `occurredAt` | timestamp (mode `string`) | JS ISO string, never raw SQL `NOW()` (per repo convention) |
| `distinctId` | text | anonymous visitor id (PostHog-compatible) |
| `customerId` | fk? nullable | set once a visitor is identified to a lead |
| `sessionId` | text? | groups events in a visit |
| `props` | jsonb | event-specific payload; append-only, **never shallow-merged** (G7) |
| `context` | jsonb | utm_*, path, referrer, userAgent, geo — captured once per event |

Indexes: `(name, occurredAt)`, `(customerId)`, `(sessionId)`. Retention/rollup is a later concern (mirror the analytics snapshot pattern if volume warrants).

## 8. Privacy & compliance (pragmatic minimum — G9)

- **Mask PII in replays** — name, phone, address, email inputs are never recorded (PostHog masks inputs by default; we explicitly confirm the funnels' custom fields are covered).
- **Sanitize before fan-out** — the facade's central sanitize step strips/hashes PII from `props`/`context` before any provider sees it.
- **Disclose** — privacy-policy update covering session recording, analytics, and IP/geo collection.
- **No consent banner in v1** — owner's explicit call; documented here as an accepted, revisitable risk (CCPA/CPRA exposure). Escalating to a banner is a self-contained future addition (no architectural change).

## 9. Phases

Each phase ships independently. Status legend: ☐ not started · ◐ in progress · ☑ done.

### Phase 0 — Privacy foundation ☐  *(effort: S)*
Privacy-policy copy (session recording, analytics, IP/geo). PII-masking policy decided and documented. This is legal cover and must precede recording real sessions.

### Phase 1 — Emit seam + PostHog + funnel drop-off ☐  *(effort: M, ~2–3 days)*
The priority. Builds the **spine** (registry, facade, provider interface, first-party provider, `observability_events` table + DAL, sanitize) — kept minimal/YAGNI — **and** the PostHog provider, reverse-proxied. Bolt `track()` into `use-funnel-tracking.ts`; `identify()` on submit links anonymous→lead. Deliver: funnel drop-off insight (drop-off per step, sliceable by campaign/UTM) + session replay on.

### Phase 2 — Sentry provider (reliability) ☐  *(effort: S–M, ~1 day)*
`@sentry/nextjs`, source maps, tunneled, release tracking, tRPC + funnel-form error capture, email alert on new issues. *Small enough to pull ahead of Phase 1 if the owner wants the safety net first.*

### Phase 3 — First-party read-source → unified ROAS + drop-off dashboard ☐  *(effort: M–L, ~3–5 days)*
Add an analytics `source()` that reads `observability_events`, filling the "B4" gap (G2). End state: CPL, ROAS-per-creative, and funnel drop-off in one owned dashboard, not dependent on PostHog retention. **Depends on** the analytics feature (2026-07-28 spec) landing far enough to host a new source/metric. **Open decision:** keep anonymous drop-off in PostHog only (less build) vs. also persist it first-party (fully owned, more build) — default PostHog-only, promote on demand.

### Phase 4 — Vercel Web Analytics + Speed Insights ☐  *(optional, effort: XS, ~1h)*
Core Web Vitals / page speed (affects Meta ad quality score + conversion). One-line install, free tier. Independent of the seam.

## 10. Requirements

**Functional**
- **R1.** A single `track(event, payload, ctx)` facade; call sites import only it + an event name — never a vendor SDK.
- **R2.** A typed, compile-time event registry; a new event = one `defineEvent`.
- **R3.** Providers behind a common interface, individually enabled via `isXConfigured()`; a missing/dark provider is never an error.
- **R4.** Generic `observability_events` first-party store, DAL-owned writes, not funnel-specific.
- **R5.** Central PII sanitization ahead of provider fan-out.
- **R6.** Funnel drop-off visible per step, sliceable by campaign/creative (UTM); anonymous visitor identifiable to a lead on submit.
- **R7.** Error/crash alerting for real users (email).
- **R8.** Read-side `source()` exposing funnel drop-off to the existing analytics dashboard.

**Non-functional**
- **N1.** Zero vendor coupling at call sites; provider swap touches only the provider registry.
- **N2.** Providers follow the existing `providers/<name>/` + `createProviderConfig` shape (G3/G4); server-only keys never client-shipped.
- **N3.** Adblock-resilient ingestion (reverse-proxy rewrite) for PostHog + Sentry.
- **N4.** jsonb `props`/`context` append-only, never shallow-merged (G7).
- **N5.** Free-tier only (G10).
- **N6.** Privacy: masked replays + sanitize + disclosure; banner deferred (G9).
- **N7.** Extensible to non-funnel domains (SEO, records, scheduling) with no new infrastructure.

## 11. Rejected / deferred alternatives

- **Google Analytics 4** — rejected for the funnel-drop-off job: sampled data, 24–48h delay, clunky funnel UI. PostHog does this better and also gives replay.
- **Microsoft Clarity** — deferred: excellent *unlimited*-free replay, but no funnel analysis and a third dashboard. Revisit only if PostHog's 5k-recordings/mo free cap is exceeded.
- **All-in-one paid (PostHog paid tiers, Datadog)** — out on budget (G10).
- **Consent banner** — deferred per owner's pragmatic-minimum stance (G9); addable later with no architectural change.
- **Folding Meta Pixel/CAPI behind the seam** — deferred; it works today, don't refactor working code.

## 12. Open decisions (resolve during planning)

1. **Phase 3 anonymous drop-off:** PostHog-only vs. also first-party-persisted. Default: PostHog-only.
2. **Phase order:** keep funnel-first, or pull Sentry (Phase 2) ahead for immediate crash safety.
3. **Domain home:** `domains/observability/` sibling to `domains/analytics/` (recommended) — confirm during planning.

## 13. Status tracker (for future sessions)

- **2026-07-30** — Epic designed and spec written. Roadmap + decoupled architecture approved by owner (A+C blend; funnel-drop-off-first; free-tier; pragmatic privacy; "providers" terminology, no "sink"). **Next:** implementation plan (writing-plans), then break into GitHub issues (to-issues). No code written yet. All phases ☐.
