# Showcase Funnel System — Design Spec

**Status:** Design approved (brainstorm 2026-06-17). Ready for implementation plan.
**Owner:** Oliver P
**Scope:** The Meta-advertised, high-conversion lead funnels for the **Showcase** offer across three trades (Kitchen, Bathroom, Complete-Interior). Covers the offer definition, funnel UX, subdomain architecture, content model, CRM lead plumbing, and the Meta Pixel + Conversions API (CAPI) measurement layer.

> **Division of labor:** A human media buyer owns everything on `business.facebook.com` (campaigns, ad sets, creative placement, budget). **We own the funnels, the offer/content North Star, and the full measurement loop back to Meta (Pixel front-end + CAPI back-end).** This spec is our half.

---

## 0. Relationship to existing Meta strategy (coexistence note)

There is a prior Meta-ads strategy on file — **Equity Reset** and **StormGuard Roofing** programs, plus a "fully CLI-automated" ambition — documented in `docs/plans/meta-ads-compound-intelligence.md` (issue #3) and `memory/project-meta-ads-strategy.md`.

**Those programs coexist with Showcase but are explicitly out of scope here.** Showcase is the sole focus of this build. This spec does not modify, deprecate, or depend on Equity Reset / StormGuard. The two are parallel initiatives.

**Stale-doc flags raised during this brainstorm (fix separately, do not block this work):**
- `CLAUDE.md` + `MEMORY.md` "Project Overview" claim **Payload CMS (MongoDB)** is in the stack. The code has neither (no `payload` in `package.json`, no Mongo). This is why we chose code-config over a CMS for funnel content.
- The compound-intelligence spec describes a full Pixel/CAPI pipeline, but **none of it is wired** in the codebase today (`grep` for `fbq`/pixel/CAPI finds only trade *content* constants). Measurement is greenfield.

---

## 1. The Offer (North Star content)

**Showcase is a casting call, not a discount ad.** Tri Pros — positioned (in mindset, not necessarily in copy) as a large, established construction company revamping its brand presence — is **selecting a limited number of homes** to feature as portfolio showpieces.

**The deal:**
- Chosen homeowners receive a **discounted, AAA-grade ("best of the best") remodel** — quality is non-negotiable because the result must photograph/film beautifully.
- In exchange: **before / during / after photo + video rights**, and the home is featured on our website and ads.
- This lets future customers see real Tri Pros work without us having "hired" them as testimonials — it manufactures social proof.

**Mechanics that make it convert:**
- **Per-trade, never generic.** Kitchen Showcase, Bathroom Showcase, Complete-Interior Showcase. Each funnel speaks only to its trade (a kitchen funnel shows kitchen language, kitchen cards, kitchen before/afters).
- **Real, stated scarcity.** "We're selecting **5** [kitchens] in [area]." Limited slots + "does your home fit the look we're going for" is the core psychological engine (scarcity + qualification/casting).
- **Selectivity reframes the transaction.** The homeowner is *applying to be chosen*, not *requesting a quote*. This raises perceived value and lowers price-shopping behavior.

**Guardrails (from existing creative standards):**
- No pricing on forms — pricing happens in the in-home meeting.
- No government/rebate/tax-credit language.
- No promises not explicitly approved (no insurance/warranty-transfer claims).

---

## 2. Funnel objective & flow

**Framing:** soft casting — *"See if your home qualifies for one of our Showcase spots."* (Selective enough to carry the scarcity story; low enough friction to convert well.)

**Conversion model — lead-first, enrich-second:** a lead is created the **instant PII is submitted**; every step after that is enrichment. A visitor who abandons after PII is still a captured lead (and has already fired the Meta `Lead` event).

**Terminal action:** **soft preferred-time capture** — the homeowner picks a date + window; we store it and a human confirms/locks the real appointment on a follow-up call. (No real-time calendar booking at launch — see §9.)

### Shared skeleton (one engine, trade-specific content)

1. **Branded hero** — Tri Pros logo, headline/subhead matched to the ad creative + Showcase offer, scarcity cue ("Selecting 5 kitchens…"), single CTA to begin. **Not** a cold question; it must feel branded and premium first.
2. **Micro-commitment** — 1–2 trade-specific visual card taps (e.g. kitchen: *L-shape / U-shape / galley / island / other*). Foot-in-the-door: a visitor who has already tapped twice converts on the PII step far better, and the taps reinforce the "do you qualify" framing.
3. **PII form** → **lead created + `Lead` event fires here.** From this point the lead persists regardless of completion.
4. **Enrichment** — trade-specific qualifying questions (age/condition, scope, style-fit, etc.) **+ preferred appointment date/time** (soft capture). Fires `Schedule` on time selection; `CompleteRegistration` on full completion.
5. **Confirmation** — before/after portfolio proof, scarcity reinforcement, clear "what happens next."

**Why this order:** the user explicitly required (a) a branded hero before any question, (b) micro-commitment before PII, and (c) PII early enough that a lead is guaranteed before the longer enrichment tail.

---

## 3. Technical architecture

### 3.1 Generic subdomain dispatcher

Funnels are served on real subdomains (`kitchens.triprosremodeling.com`) for unmistakable separation from the app, but run inside the **existing single Next.js app** to reuse lead/CRM/portfolio plumbing.

- Root **`middleware.ts`** reads the request host, looks the subdomain label up in a **`SUBDOMAIN_ROUTES` registry**, and `rewrite()`s to the internal path — **URL bar unchanged** (visitor stays on the subdomain; internal path is hidden). Unregistered hosts (apex, `www`) fall through untouched.
- The middleware is **generic** — it knows nothing about "funnels" specifically. Funnels are three registry entries; `voip` (an already-planned subdomain) is another. **Adding a subdomain = one registry line.**
- `rewrite` (not `redirect`): no URL change, no extra round-trip, SEO-clean (the subdomain is canonical).

```ts
// middleware.ts (root)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SUBDOMAIN_ROUTES } from '@/shared/config/subdomains'

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  const subdomain = host.split('.')[0]
  const basePath = SUBDOMAIN_ROUTES[subdomain]
  if (!basePath) {
    return NextResponse.next()
  }
  const url = request.nextUrl.clone()
  url.pathname = `${basePath}${url.pathname === '/' ? '' : url.pathname}`
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sw.js).*)'],
}
```

```ts
// src/features/funnels/constants/funnel-hosts.ts
export const FUNNEL_SUBDOMAINS = {
  kitchens: 'kitchen',
  bathrooms: 'bathroom',
  interiors: 'interior',
} as const
export type FunnelSubdomain = keyof typeof FUNNEL_SUBDOMAINS
export type FunnelTrade = (typeof FUNNEL_SUBDOMAINS)[FunnelSubdomain]
```

```ts
// src/shared/config/subdomains.ts — single source of truth: host label → internal base path
import { ROOTS } from '@/shared/config/roots'
import { FUNNEL_SUBDOMAINS } from '@/features/funnels/constants/funnel-hosts'

export const SUBDOMAIN_ROUTES: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(FUNNEL_SUBDOMAINS).map(([sub, trade]) => [sub, ROOTS.funnels.trade(trade)]),
  ),
  // voip: ROOTS.voip.root(),  // future — added when the /voip route exists (NOT registered yet)
}
```

### 3.2 `funnels/` route segment — the codebase boundary

```
src/app/(frontend)/funnels/
├── layout.tsx          ← funnel-only chrome; <MetaPixel/> injected ONLY here
└── [trade]/
    └── page.tsx        ← reads params.trade ("kitchen"|"bathroom"|"interior")
```

- **`funnels` is a REAL path segment, NOT a parenthesized route group.** A route group `(funnels)` is stripped from the URL, so the route would serve at `/[trade]` (e.g. `/kitchen`) — but the middleware rewrites to `/funnels/[trade]`, so a group would 404 every subdomain. A real segment makes `/funnels/[trade]` the actual URL the rewrite targets. (Discovered during Plan 1 implementation; the original "(funnels) group" framing was wrong.)
- Has **its own minimal layout** (`funnels/layout.tsx`, no marketing nav/footer) — the funnel/app boundary is preserved by the dedicated directory + layout, not by the parentheses. Precedent for standalone public surfaces: `proposal-flow`, `intake`.
- The Pixel lives in this layout only — it never loads on the marketing site or the app.
- Side effect: `/funnels/[trade]` is also reachable on the apex (`triprosremodeling.com/funnels/kitchen`). Acceptable — the marketed canonical URL is the subdomain; an apex→subdomain canonical redirect can be added later if desired.

### 3.3 Paths, hosts, helpers

- **`roots.ts` owns all paths** — add `ROOTS.funnels.trade(trade)` (internal rewrite target), `ROOTS.funnels.subdomain(sub)` (public subdomain URL), and `ROOTS.voip.root()`. No hardcoded paths in middleware.
- **`APP_HOSTS`** extended: prod gains the funnel subdomains conceptually via a Vercel **wildcard domain** `*.triprosremodeling.com`; dev gains `*.localhost` (e.g. `kitchens.localhost:3000`, which browsers resolve with no hosts-file edits).
- **`getPublicBaseUrl()`** made **host-aware** so funnel-origin links and the Pixel use the funnel subdomain, not the apex.
- The subdomain registry is documented as a short **convention doc**, sibling to `docs/codebase-conventions/webhook-routes.md`.

### 3.4 One-time infra

- Vercel: add wildcard domain `*.triprosremodeling.com`.
- DNS: wildcard record pointing at the Vercel deployment.

---

## 4. Content model

**One engine, three configs.** The funnel engine is trade-agnostic; per-trade content is data.

- **`FUNNEL_CONFIG[trade]`** — typed objects in `src/features/funnels/constants/`. Each holds: hero copy (headline/subhead/scarcity line), micro-commitment card set, enrichment question set, disclaimers, and per-trade theme accents.
- **Before/after proof** — queried **live from the portfolio / project DB**, filtered by trade. Auto-grows as real Showcase projects complete; no manual gallery maintenance.
- **Trade SVG icons** — `public/icons/trades/` (consistent stroke weight/style, monochrome with accent on selection), per the funnel-design standards. Not Lucide.
- **No CMS.** Payload is not in this codebase. Copy edits are commits. If marketing later needs no-deploy copy edits, the config shape makes lifting *just copy* into a data source a clean later migration.

**Design-quality bar (from funnel-design standards):** trade selection and micro-commitment use **branded selectable cards, not radio buttons**; each step feels distinct (not the same grid five times); progress indicator feels designed; mobile-first.

---

## 5. Lead plumbing & CRM integration

Funnel leads enter the **same** pipeline as every other lead — no parallel system.

- Each funnel registers as a **lead source** (existing lead-sources system).
- Funnel submit routes through the existing **`customerIntakeService`** (`src/shared/services/customer-intake.service.ts`) — the channel-agnostic intake orchestrator.
- Captured into `customer.leadMetaJSON`:
  - `interestedTradesRaw: [trade]` — drives downstream trade attributes uniformly.
  - `originCampaign` — from captured UTM (see §7.4).
  - `scheduledFor` — the preferred appointment datetime (human confirms; **no auto-meeting created**, per the 2026-06-05 lead-intake-normalization design).
  - `source` — a discriminated-union variant identifying the Showcase funnel + trade.
- The lead then flows into the standard pipeline / VoIP / DNC machinery like any other lead.
- **Resilience invariant:** lead creation must never be blocked by a downstream measurement failure (Pixel/CAPI). Fire-and-forget the measurement side; persist the lead first.

---

## 6. Measurement layer (Meta Pixel + CAPI)

### 6.1 Topology & ownership

- **One shared Pixel/dataset** across all three funnels (trade carried as a parameter, e.g. `content_category`). At a constrained budget, pooled conversion volume is essential — three separate pixels would each starve and never exit the learning phase. Retargeting/lookalikes still segment by the trade parameter.
- **Owned by Oliver** (on the business's Meta Business profile). The Pixel/dataset **does not exist yet** — creating it + generating a **CAPI access token** is measurement task #1.

### 6.2 Dual-fire + dedup principle

Every browser-stage event fires **twice** — once from the browser (Pixel) and once from the server (CAPI) — carrying the **same `event_id`**. Meta dedupes on that ID. Browser fire gives speed + client signals; server fire is immune to ad-blockers/iOS/cookie loss and carries hashed PII (advanced matching). Target ~95% signal capture vs ~60% browser-only.

### 6.3 Event map

| Stage | Where | Pixel (browser) | CAPI (server) | Purpose |
|---|---|---|---|---|
| Hero loads | Funnel | `PageView` | — | audience seed |
| Micro-commitment tap | Funnel | `ViewContent` (trade) | — | engagement |
| **PII submit → lead created** | Funnel | `Lead` | `Lead` (dedup) | **primary optimization event** |
| Appointment time selected | Funnel | `Schedule` | `Schedule` (dedup) | high-intent |
| Enrichment complete | Funnel | `CompleteRegistration` | — | full-data lead |
| Lead contacted (CRM) | Server | — | `Contact` | quality feedback |
| Meeting completed | Server | — | `MeetingComplete` (custom) | funnel truth |
| Proposal sent | Server | — | `ProposalSent` (custom) | bottom-funnel |
| **Contract signed** | Server | — | `Purchase` (+ value) | ROAS / value optimization |

The bottom four are server-only — they happen after the visitor leaves and are exactly what the CRM pipeline already knows (meeting/proposal/contract transitions emit CAPI server-side). This closes the loop for value-based optimization and lookalikes.

### 6.4 Attribution plumbing

- **Advanced matching:** hash email/phone server-side and include on CAPI events.
- **Click IDs:** capture `fbclid` → `_fbc`, plus `_fbp`, on landing; carry into CAPI events for attribution.
- **Optimization event cadence:** start campaigns optimizing for `Lead` (train the model on volume), graduate to `Schedule` / value-based once volume supports it. Coordinated with the media buyer.

---

## 7. Experience & non-functional requirements

1. **Motion** — entrance/exit animations + inter-step transitions via `motion/react` (per motion-patterns memory). Premium, never janky; honor `prefers-reduced-motion`.
2. **Multi-step with back navigation** — answers preserved when stepping back.
3. **Progress persistence** — autosave funnel state (localStorage keyed by a session id; server-side draft once the lead exists). **Refresh/return resumes, never resets.** Also enables abandonment retargeting.
4. **UTM + click-id capture** — `utm_*`, `fbclid`, `gclid` captured on landing, persisted through the funnel, attached to the lead (`originCampaign`).
5. **Branded every step** — Tri Pros palette/typography, designed progress indicator (not a generic counter), per-trade accent. Each step visually distinct.
6. **Mobile-first** — 60%+ of Meta traffic is mobile; touch targets ≥44px, fast LCP, lightweight hero media.
7. **Performance** — funnel routes code-split from the app; minimal JS on the hero; optimized before/after imagery.
8. **Accessibility** — keyboard-navigable cards, semantic markup, reduced-motion support, sufficient contrast.
9. **Resilience** — input validation + graceful error states on submit; lead creation never blocked by a downstream (pixel/CAPI) failure (see §5).

---

## 8. Compliance / privacy

- **TCPA consent** on the PII step — explicit checkbox + clear language, since leads enter a **call/SMS** pipeline. Wired to the existing **DNC/consent** handling.
- **Privacy Policy + disclaimer** links on every data-collecting step; trust microcopy ("your info is safe / no spam").
- **No pricing on forms; no government/rebate language; no unapproved promises** (creative guardrails, §1).

---

## 9. Scope boundaries & phasing

**In scope:** the 3 funnels (kitchen / bathroom / complete-interior), subdomain dispatcher + `(funnels)` group, shared funnel engine, per-trade config + portfolio-DB proof, Pixel + CAPI measurement loop, the conversion playbook doc.

**Out of scope (for now):**
- Real-time calendar/availability booking (soft preferred-time capture only).
- CMS-editable copy (code config only).
- A/B experiment ledger (playbook captures principles; ledger comes later once traffic supports it).
- Equity Reset / StormGuard programs.

**Suggested phasing:**
1. Subdomain dispatcher + `(funnels)` skeleton + **one trade (kitchen) end-to-end** (hero → confirmation, lead persists to CRM).
2. Pixel + CAPI wiring (dataset creation, dual-fire + dedup, pipeline server events).
3. Remaining two trades (bathroom, interior) via config.
4. Polish — animation, autosave/resume, accessibility, playbook doc.

---

## 10. Learnings capture

- **`docs/marketing/funnel-conversion-playbook.md`** — a living, curated catalog of the psychological levers in play (scarcity/casting, foot-in-the-door micro-commitments, loss-aversion, social proof via before/afters, etc.), each with *why it works here* and *where it's applied in our funnel*.
- **Read before any funnel change**, so every iteration is informed by accumulated knowledge instead of starting cold. New insight = one commit.
- A structured experiment ledger is intentionally deferred (§9) until A/B traffic volume makes it meaningful.

---

## 11. Open coordination items

- [ ] Create the shared Pixel/dataset + CAPI token (Oliver, via Events Manager).
- [ ] Add wildcard domain `*.triprosremodeling.com` on Vercel + DNS wildcard record.
- [ ] Confirm optimization-event cadence (`Lead` → `Schedule`/value) with the media buyer.
- [ ] Approve final per-trade card options + hero copy (drafted in the playbook).
