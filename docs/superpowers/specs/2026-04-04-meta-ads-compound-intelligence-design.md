# Meta Ads Compound Intelligence System — Design Spec

**Date**: 2026-04-04
**Status**: Design in progress (Sections 1-5 approved, Section 6 pending)
**GitHub Issue**: [#3](https://github.com/OlisDevSpot/tri-pros-website/issues/3)
**Owner**: Oliver P

---

## Executive Summary

A fully automated Meta (Facebook/Instagram) advertising system for Tri Pros Remodeling. Two programs — **Equity Reset** and **StormGuard Roofing Plan** — run as separate campaigns with a retargeting pool. Traffic lands on branded multi-step intake funnels on our website. Every conversion event feeds back to Meta's pixel via both browser-side pixel and server-side CAPI, creating a compound learning loop: more conversions = smarter AI targeting = better leads = more conversions.

The system is managed entirely through CLI (`pnpm meta`) with preset guardrails. No manual Ads Manager work required for day-to-day operations.

---

## Table of Contents

1. [Company Context](#1-company-context)
2. [Programs](#2-programs)
3. [Campaign Architecture](#3-campaign-architecture)
4. [Landing Page Funnels](#4-landing-page-funnels)
5. [Creative Engine](#5-creative-engine)
6. [Pixel & CAPI Integration](#6-pixel--capi-integration)
7. [Automation & Guardrails](#7-automation--guardrails)
8. [KPIs & Reporting](#8-kpis--reporting)
9. [Budget Projections](#9-budget-projections)
10. [Competitor Intelligence](#10-competitor-intelligence)

---

## 1. Company Context

### Who We Are

**Tri Pros Remodeling** — Southern California residential construction & remodeling company. Small team of highly specialized tech, business, and construction professionals.

### What We Do

11 trades across two categories:

**Energy-Efficient Projects**: Roofing, HVAC, Windows & Doors, Insulation, Solar
**General Remodeling**: Foundation, Bathroom, Kitchen, Flooring, Paint, Decking

### How We Make Money

1. Generate in-home meetings through telemarketing & social media
2. Run structured in-home sales presentations using program-specific pitch frameworks
3. Close same-day or via DocuSign follow-up
4. Average contract: $8K-$40K+ depending on scope

### Sales Cycle

Lead → Appointment Set → In-Home Meeting (45-90 min) → Proposal Sent (DocuSign) → Follow-Up → Signed Contract → Project Delivered

### Competitive Advantage (S.W.C.E. Framework)

- **Security**: Licensed CA contractor, $2M general liability, active workers' comp
- **Warranty**: Manufacturer-certified installations + written workmanship warranty
- **Craftsmanship**: Licensed experienced crews, certified installer relationships
- **Experience**: 12+ years in SoCal, 500+ projects completed

### Sales Psychology Foundation

Five emotional drivers govern homeowner decisions:
1. **Fear & Risk Aversion** — "What happens if I don't fix this?"
2. **Loss Aversion** — "I'm losing money every month I don't do this"
3. **Pride of Ownership** — "This is my home. I want it to be right"
4. **Social Proof** — "Other people in my situation did this and were right"
5. **Trust & Safety** — "I need to know this company won't disappear"

Core truth: **Homeowners buy on emotion. They justify with logic.**

### Target Customer

- SoCal homeowners, age 35-70
- Premium/high-end positioning (tech-first, luxury presentations)
- Two fundamental motivations: **Fix something broken** OR **Improve/upgrade something**

---

## 2. Programs

### Program 1: The Equity Reset Program

**Target customer**: Homeowners with 20%+ equity in their home who are carrying high-interest debt (credit cards, car payments, other construction loans).

**Core pitch**: Use existing home equity to consolidate high-interest debt into a lower-interest, fixed, secured financial option. This dramatically reduces overall monthly payments, freeing up budget for home upgrades. The homeowner's monthly payments stay the same or go lower, they get their fixes/upgrades done, property value increases significantly, and they future-proof their house for decades with warranties that protect their family long term.

**The value chain**:
1. Homeowner has high-interest debt ($500-$2,000+/month in credit cards, car loans, etc.)
2. Homeowner also has home equity (20%+ required)
3. Tri Pros helps restructure: replace high-interest debt with low-interest secured option
4. Monthly payments drop significantly → new budget freed up
5. That freed budget funds home improvements (at the same or lower monthly payment)
6. Home improvements increase property value (often exceeding project cost)
7. Warranties protect the investment for decades

**Emotional drivers**: Loss aversion (bleeding money to interest), relief (monthly burden lifted), pride (home finally upgraded), security (warranties + future-proofing)

**Who qualifies**:
- 20%+ home equity
- Carrying $10K+ in high-interest debt (credit cards, auto loans, personal loans, other construction financing)
- Monthly debt payments are a pain point
- Home needs work but "can't afford it" (they can — the debt restructuring unlocks the budget)

**Why this is powerful**: Most remodeling companies sell construction. Equity Reset sells financial freedom that happens to include construction. The homeowner doesn't feel like they're spending money — they feel like they're saving it.

### Program 2: StormGuard Roofing Plan

**Target customer**: Homeowners 40-70 with roofs 10+ years old, in areas experiencing weather events (rain, wind, heat waves).

**Core pitch**: Southern California's weather patterns are shifting. Storms are getting worse, heat cycles are more extreme. StormGuard is a limited-availability inspection and priority protection plan — not a sales pitch for a roof. The homeowner feels like they're being let into something exclusive, not sold to.

**The psychology**: Nobody wakes up wanting to buy a roof. They wake up worried about their roof. StormGuard doesn't sell roofing — it sells protection you almost missed.

**The hooks**:
- "Free storm damage assessment" — positions Tri Pros as the expert, not the salesman
- "Priority scheduling before storm season" — scarcity that's real (crews book up)
- Lead with a question, not a pitch: "When was the last time someone actually looked at your roof?"
- Frame as informational/protective: "SoCal homeowners are finding storm damage they didn't know they had"
- The CTA is an assessment, not a quote: "See if your roof qualifies for StormGuard coverage"

**What makes it not feel like an ad**:
- Educational tone, not promotional
- Positions the homeowner as someone who's being smart, not someone being sold to
- The "assessment" framing makes the next step feel like due diligence, not a sales call

**Emotional drivers**: Fear (roof failure = catastrophic damage), loss aversion (cost of waiting >> cost of fixing now), trust (assessment-first approach builds credibility before any sales conversation)

**Relevant pain points from our taxonomy**:
- Active or recent roof leak (CRITICAL urgency)
- Roof aging or nearing end of life (HIGH urgency)
- Storm damage concerns
- Loss frame: "A roof that fails in winter can cause $20,000-$40,000 in interior water damage. The replacement cost today is a fraction of that."

### Creative Guardrails (Both Programs)

1. **No government/rebate language** — never mention tax credits, federal programs, utility rebates as a selling tool
2. **No promises we haven't agreed upon** — no insurance documentation, no warranty transfer claims unless explicitly approved
3. **Before/after photos from portfolio DB** — dynamic, not manual
4. **No pricing on funnels** — pricing conversations happen in the meeting
5. **Universal first question on all funnels**: Fix vs Improve (see Section 4)

---

## 3. Campaign Architecture

### Why 2 Separate Campaigns (Not 1 Campaign with 2 Ad Sets)

The programs target fundamentally different customer psychologies:

| | Equity Reset | StormGuard |
|---|---|---|
| Customer state | Financially stressed, carrying debt, has equity | Worried about their roof, weather anxiety |
| Emotional driver | Loss aversion (bleeding money to interest) | Fear (what happens if this fails) |
| Urgency type | Financial opportunity window | Physical risk + seasonal timing |
| Landing page | `/lp/equity-reset` | `/lp/stormguard` |
| Ideal age skew | 35-60 (mortgaged, debt-carrying) | 40-70 (longer homeownership, older roofs) |

**Independent pixel learning**: Meta's AI builds separate conversion profiles per campaign. Mixing them in one campaign muddies the signal.

**Budget control**: CBO (Campaign Budget Optimization) in a single campaign would auto-distribute budget and could starve one program entirely based on early short-term performance. Separate campaigns give controlled learning.

**Clean ROAS comparison**: Separate campaigns let us directly answer "Which program is a better investment?"

### Structure

```
$5,000/month total

Campaign 1: Equity Reset ──────────── $1,750/mo ($58/day)
  └── Ad Set: SoCal Homeowners 35-70
        ├── Ad A (video creative)
        └── Ad B (video creative)
        Landing: /lp/equity-reset

Campaign 2: StormGuard Roofing ───── $1,750/mo ($58/day)
  └── Ad Set: SoCal Homeowners 40-70
        ├── Ad A (video creative)
        └── Ad B (video creative)
        Landing: /lp/stormguard

Campaign 3: Retargeting ──────────── $1,000/mo ($33/day)
  └── Ad Set: Website Visitors 30-day (didn't convert)
        ├── Ad A (Equity Reset retarget)
        └── Ad B (StormGuard retarget)
        Landing: varies by original visit

Creative Testing Reserve ─────────── $500/mo ($17/day)
  └── Rotates new variants into winning campaigns
```

### Targeting

- **Geography**: Southern California (LA, Orange County, San Diego, Riverside, San Bernardino)
- **Age**: 35-70 (Equity Reset), 40-70 (StormGuard)
- **Behaviors**: Homeowners (likely)
- **Bid Strategy**: LOWEST_COST_WITHOUT_CAP
- **Optimization Goal**: LEAD_GENERATION
- **All ads created PAUSED** — nothing spends until manually activated

### Why 2 Ads Per Ad Set (Not 3+)

At $58/day per campaign, each ad gets ~$29/day. At $40-60 CPL that's ~15-22 leads per ad per month — enough for directional signal. Three ads at $19/day each would starve all of them.

---

## 4. Landing Page Funnels

### Design Principles

1. **Multi-step intake form** on our own website (NOT Meta Lead Forms) — we control the experience, collect pixel data, own the funnel
2. **Progressive commitment** — each step is a tiny "yes" that makes the next feel natural
3. **Every step fires a pixel event** — Meta learns who engages at each depth
4. **Questions double as lead qualification** — data feeds directly into CRM for telemarketing
5. **Dynamic content from portfolio DB** — confirmation page shows projects near the lead's zip code

### Universal Branching Question (Step 1 — ALL Funnels)

> "What best describes what you're looking for?"
> - Something in my home isn't working right (**FIX**)
> - I want to add or upgrade something in my home (**IMPROVE**)

This is the main branching point for all pain discovery. It determines:
- Which pain points the funnel surfaces next
- Which emotional drivers the copy uses
- How the telemarketing team opens the call
- Which program the lead is most likely suited for

### Funnel UX Requirements

- **Selectable card grids, NOT radio buttons** — each card has: trade SVG icon + trade name + short description
- **Multi-select (checkbox)** for trade questions — customers often need more than one trade
- **Each step must feel visually unique** — not the same layout repeated 5 times
- **Branded throughout** — Tri Pros color palette, typography, progress indicator
- **Micro-animations** between steps (motion/react)
- **Mobile-first** — 60%+ of Meta traffic is mobile
- **Trade SVG icon set** in `public/icons/trades/` — consistent style, all 11 trades covered

### Funnel 1: Equity Reset (`/lp/equity-reset`)

**Story arc**: Your monthly payments are higher than they need to be. Your home equity can unlock lower payments AND fund the upgrades your home needs — same monthly cost or less.

```
Step 1: Universal Branch (Fix vs Improve)
  [pixel: ViewContent]

Step 2: Pain Identification
  "What's weighing on you most right now?"
  ○ My monthly payments feel out of control (credit cards, loans)
  ○ My home needs work but I can't afford another payment
  ○ I'm paying too much interest on debt I can't get rid of
  ○ I want to upgrade my home AND simplify my finances
  [pixel: CustomEvent "QualifyStep"]

Step 3: Home Context
  "Tell us about your home"
  - How long have you owned it? (slider or options)
  - Approximate home value range
  - Zip code
  [pixel: CustomEvent "HomeContextStep"]

Step 4: Contact (Value Exchange)
  "Here's what happens next: we'll show you exactly how
   much budget your home equity can unlock — and what your
   home could look like after. No obligation. No pressure."
  [name, phone, email]
  [pixel: Lead] [CAPI: Lead]

Step 5: Confirmation + Social Proof
  "You're in. We'll reach out within 24 hours."
  - Dynamic before/after from portfolio DB near their zip
  - Trust badges (S.W.C.E.)
  [pixel: CompleteRegistration]
```

### Funnel 2: StormGuard (`/lp/stormguard`)

**Story arc**: SoCal weather is shifting. Smart homeowners are getting ahead of it with a free assessment — before a small problem becomes a $40K interior disaster.

```
Step 1: Universal Branch (Fix vs Improve)
  [pixel: ViewContent]

Step 2: Roof Concern Identification
  "What's going on with your roof?"
  ○ I've noticed a leak or water stain
  ○ My roof is getting old — I'm not sure how much life it has
  ○ I've seen damage after recent storms or wind
  ○ Nothing yet — but I want to stay ahead of it
  [pixel: CustomEvent "QualifyStep"]

Step 3: Home Context
  "A few details so we can assess your situation"
  - Approximate roof age (or "not sure")
  - Home built before/after 2000
  - Zip code
  [pixel: CustomEvent "HomeContextStep"]

Step 4: Contact (Value Exchange)
  "We'll send one of our certified inspectors to assess
   your roof — no cost, no commitment. If there's nothing
   to worry about, we'll tell you that too."
  [name, phone, email]
  [pixel: Lead] [CAPI: Lead]

Step 5: Confirmation + Social Proof
  "Your StormGuard assessment is booked. We'll reach out
   within 24 hours to schedule."
  - Dynamic before/after roofing projects near their zip
  - "SoCal homeowners are finding damage they didn't know they had"
  [pixel: CompleteRegistration]
```

### Pixel Events Across Both Funnels

| Step | Pixel Event | What Meta Learns |
|---|---|---|
| Page load | `PageView` | Who lands (baseline) |
| Step 1 complete | `ViewContent` | Who engages (interested) |
| Step 2 complete | `CustomEvent: QualifyStep` | Who has real need |
| Step 3 complete | `CustomEvent: HomeContextStep` | Who's in service area + timeline |
| Step 4 complete | `Lead` | Who converts (optimization target) |
| Step 5 view | `CompleteRegistration` | Confirmed leads (filters accidentals) |

---

## 5. Creative Engine

### Approach: Manual Creative, Automated Distribution

The creative (video/image) is produced manually by the team. The CLI handles everything after that: upload, metadata, campaign attachment, rotation.

### Directory Structure

```
assets/meta-creatives/
├── equity-reset/
│   ├── PROGRAM.md              ← program definition (source of truth)
│   ├── COPY-VARIANTS.md        ← generated ad copy variants (generated once by Claude)
│   ├── videos/
│   │   └── er-001-explainer.mp4
│   └── images/
│       └── er-001-beforeafter.jpg
│
├── stormguard/
│   ├── PROGRAM.md              ← program definition (source of truth)
│   ├── COPY-VARIANTS.md        ← generated ad copy variants (generated once by Claude)
│   ├── videos/
│   │   └── sg-001-inspection.mp4
│   └── images/
│       └── sg-001-damage-reveal.jpg
│
└── retargeting/
    ├── PROGRAM.md
    ├── COPY-VARIANTS.md
    └── videos/
        └── rt-001-trust.mp4
```

### How It Works

1. **PROGRAM.md** is written once (with Claude) — defines the program story, target customer, pain points, psychological triggers, landing URL, CTA strategy
2. **COPY-VARIANTS.md** is generated once by Claude from PROGRAM.md + sales psychology docs — contains 6-10 ad copy variants (headline, primary text, description, CTA), each tagged with placement and emotional driver
3. **You drop a video** into the program's `videos/` directory
4. **Run**: `pnpm meta upload-creative stormguard/videos/sg-001-inspection.mp4`
5. **CLI reads PROGRAM.md + COPY-VARIANTS.md** → selects best unused copy variant → uploads video to Meta → creates AdCreative + Ad (PAUSED) → logs which variant was used
6. **Rotation is automated**: pause when frequency > 3.0, activate next queued creative

### CLI Commands

```bash
pnpm meta upload-creative <file>     # Upload asset + create ad from PROGRAM.md context
pnpm meta creative-status            # List all creatives: active/paused, frequency, CTR
pnpm meta rotate-creative            # Pause worst performer, activate next queued
```

---

## 6. Pixel & CAPI Integration

**Status**: NOT YET PRESENTED — this section needs to be designed in the next session.

**Scope**: Browser-side pixel + server-side Conversions API (CAPI) integration. The CAPI sends events from our backend (tRPC/Next.js) directly to Meta, bypassing browser limitations (iOS 14+, ad blockers). This is critical for the full pipeline feedback loop.

**Pipeline events to send via CAPI**:

| CRM Event | Meta Event | Where It Fires |
|---|---|---|
| Lead submits form | `Lead` | Landing page (browser pixel + CAPI) |
| Telemarketing calls lead | `CustomEvent: Contact` | CRM/backend |
| Appointment booked | `Schedule` | CRM/backend |
| Meeting completed | `CustomEvent: MeetingComplete` | CRM/backend |
| Proposal sent | `CustomEvent: ProposalSent` | DocuSign trigger |
| Contract signed | `Purchase` | DocuSign webhook |

The `Purchase` event is the gold standard. Once Meta has 50+ Purchase events, it stops optimizing for "people who fill out forms" and starts optimizing for "people who actually sign contracts."

---

## 7. Automation & Guardrails

### Tier 1: Hard Limits (never breached, no override)

- Monthly spend cap: $5,000 — system shuts off all campaigns if hit
- Daily spend anomaly: >$250/day triggers immediate pause + alert
- No auto-activate: new campaigns/ads always created PAUSED
- No budget increases without explicit approval
- Kill switch: `pnpm meta emergency-pause` — stops everything instantly

### Tier 2: Performance Floors (auto-pause underperformers)

- CTR < 0.5% after 1,000 impressions → pause ad, flag for review
- CPL > $80 after 10 leads → pause ad set, suggest reallocation
- Frequency > 3.5 → pause ad, rotate creative
- CPC > $8 sustained 7 days → flag targeting issue
- Zero conversions after $150 spend → pause, investigate

### Tier 3: Optimization Rules (auto-adjust within bounds)

- Budget shift between programs: max 60/40 split (from 50/50), requires 20+ leads per program + 14+ days data
- Creative rotation: every 14 days OR when frequency > 3.0
- Retargeting audience refresh: weekly
- Bid strategy: stay on LOWEST_COST, never switch to manual

### Tier 4: Reporting & Alerting

- Daily: KPI snapshot → decision audit log
- Weekly: Full performance report with recommendations
- Monthly: Budget reconciliation + strategy review
- Anomaly: Immediate alert on any Tier 2 breach

### Decision Audit Trail

Every automated action logs to `logs/meta-decisions.jsonl` with timestamp, action, reasoning, and outcome.

### Month 1 → Month 3 Autonomy Ramp

| Period | Automated | Requires Approval |
|---|---|---|
| Month 1 | Health checks, reporting, alerts, creative rotation | Budget shifts, new campaigns, audience changes |
| Month 2 | + Budget shifts within 60/40 bounds | New campaigns, audience expansion, spend increases |
| Month 3+ | + Audience expansion, lookalike creation | Spend above $5K, new programs, major strategy changes |

### CLI Commands

```bash
pnpm meta verify                # Smoke test credentials
pnpm meta init-account          # One-time setup (pixel, campaigns, audiences)
pnpm meta performance [preset]  # Pull campaign stats
pnpm meta manage-ad             # Interactive pause/activate
pnpm meta upload-creative <f>   # Upload creative from program directory
pnpm meta creative-status       # List all creatives with performance data
pnpm meta rotate-creative       # Swap lowest performer for next queued
pnpm meta dashboard             # Daily KPI dashboard
pnpm meta health-check          # Run all Tier 2 guardrail checks
pnpm meta optimize              # Propose budget shifts (requires approval)
pnpm meta pause-all             # Emergency kill switch
pnpm meta report [weekly|monthly] # Generate performance report
pnpm meta audit-log             # View decision history
```

---

## 8. KPIs & Reporting

Ranked by priority:

| Rank | KPI | Formula | Why It Matters |
|---|---|---|---|
| 1 | **CTL** (Click-to-Lead) | Leads / Clicks | Funnel conversion rate |
| 2 | **CTA** (Click-to-Appointment) | Appointments / Clicks | End-to-end efficiency |
| 3 | **CPL** (Cost Per Lead) | Spend / Leads | Unit economics baseline |
| 4 | **CPA** (Cost Per Appointment) | Spend / Appointments | Real cost metric |
| 5 | **ROAS** (Return on Ad Spend) | Revenue / Spend | The money question |
| 6 | **LTR** (Lead-to-Appointment Rate) | Appointments / Leads | Lead quality measure |
| 7 | **CTR** (Click-Through Rate) | Clicks / Impressions | Creative effectiveness |
| 8 | **CPC** (Cost Per Click) | Spend / Clicks | Market competitiveness |
| 9 | **Frequency** | Impressions / Reach | Ad fatigue detector |
| 10 | **CPM** (Cost Per 1K Impressions) | (Spend/Impressions) x 1000 | Audience saturation |

---

## 9. Budget Projections

### $5,000/month at SoCal Market Rates

| Metric | Conservative | Realistic | Optimistic |
|---|---|---|---|
| CPC | $6-8 | $4-6 | $2-4 |
| CPL | $50-80 | $30-50 | $20-30 |
| Leads/month | 60-100 | 100-165 | 165-250 |
| Lead → Appointment | 20% | 30% | 40% |
| Appointments/month | 12-20 | 30-50 | 66-100 |
| Appointment → Close | 35% | 45% | 50%+ |
| Closed deals/month | 4-7 | 14-23 | 33-50 |

At $15K-$25K average contract value, even conservative = $60K-$175K revenue on $5K spend.

### Minimum Budget Per Creative for Statistical Significance

- ~50 conversions to exit Meta's learning phase ($2,000-$3,000 at $40-60 CPL)
- ~30 conversions per variant for reliable A/B signal ($1,200-$1,800 per variant)
- 2 ads per campaign at $1,750/month = $875 per ad = ~15-22 leads each = viable signal in 30 days

---

## 10. Competitor Intelligence

### SoCal Home Improvement Meta Ads Benchmarks

| Metric | National Avg | SoCal (20-40% premium) |
|---|---|---|
| CPC | $1.50-$4.00 | $3.00-$6.00 |
| CPL (Lead Form) | $20-$60 | $30-$80 |
| CPL (Website Traffic) | $40-$100 | $60-$120+ |
| CTR | 0.70-1.20% | Creative-dependent |

### What Top Competitors Run

- **West Shore Home**: National, millions/year. Offer-driven ("up to 40% off"), before/after photos
- **Bath Planet / Bath Fitter**: Heavy lead forms, "$0 down" financing
- **Renewal by Andersen**: High-production video, free consultation
- **Local players**: $1K-$10K/month, generic creative

### What Works (Case Study Data)

- **Before/after splits**: 3.6% CTR — 5x industry average, $0.20 CPC vs $2.93 avg
- **Video testimonials** (30-60s): Best for retargeting, builds trust
- **Short-form video** (15s Reels/Stories): Best for top-of-funnel reach
- **Emotional copy** ("transform", "refresh", storytelling) outperforms feature-listing
- **Engagement increased 20%** when switching from stock photos to actual project transformations

### Tri Pros Competitive Edge

None of the competitors have our combination of:
1. Real before/after portfolio with programmatic access (R2 + Postgres)
2. Financial program (Equity Reset) — nobody leads with debt consolidation
3. Telemarketing follow-up infrastructure (speed-to-call is the #1 quality lever)
4. Full pipeline pixel feedback (most competitors only track form fills, not closes)

---

## Implementation Status

| Component | Status |
|---|---|
| Meta app published | Done |
| Pixel created | Done (`2031257387425754`) |
| Ad account verified | Done (`act_1552723459154642`) |
| CLI tools (verify, init-account, performance, manage-ad, create-campaign) | Done |
| Campaign structure (2 campaigns + retargeting) | Designed, not created |
| PROGRAM.md files (Equity Reset, StormGuard) | Designed, not written |
| COPY-VARIANTS.md files | Not generated |
| Landing pages (/lp/equity-reset, /lp/stormguard) | Not built |
| Trade SVG icon set | Not created |
| Pixel integration on landing pages | Not implemented |
| CAPI server-side event pipeline | Not designed (Section 6 pending) |
| New CLI commands (dashboard, health-check, optimize, etc.) | Not built |
| Creative upload pipeline | Not built |
| Decision audit logging | Not built |

---

## Key Files Reference

| File | Purpose |
|---|---|
| `scripts/meta/` | All CLI tools |
| `assets/meta-creatives/` | Program directories for creative assets |
| `src/pain-points.ts` | Complete pain point taxonomy (30+ items) |
| `src/features/meetings/constants/programs.ts` | Program definitions (pitch frameworks) |
| `docs/customer/decision-psychology.md` | 5 emotional drivers |
| `docs/sales/objection-handlers.md` | A.R.C. objection framework |
| `docs/company/competitive-advantage.md` | S.W.C.E. framework |
| `memory/project-meta-ads-strategy.md` | Strategy decisions + guardrails |
| `memory/feedback-funnel-design-standards.md` | Funnel UX rules |
