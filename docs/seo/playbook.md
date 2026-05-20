# Tri Pros Remodeling — SEO Playbook

> **Status:** active (v1)
> **Owners:** Internal marketing operator (TBD) + Claude (Opus 4.7)
> **Created:** 2026-05-19 (initial strategic grilling session)
> **Source-of-truth doc for the entire SEO program.** Every other doc in `docs/seo/` is downstream of this one. If you find any other doc contradicting this playbook, the playbook wins until explicitly amended here.

## How to use this doc

1. New to the SEO program? Read sections 1–4 in order, then skim 5–9.
2. Making a tactical decision? Search this doc for the relevant locked decision before improvising.
3. Disagree with something locked here? Open a discussion thread on the ROOT SEO issue. Do NOT silently work around a locked decision — the cost of drift is months of compounding loss.
4. Onboarding a marketing operator? Sections 6 (architecture) and 7 (operations) are the day-one read.

---

## 1. Executive summary

**Mission:** Make organic search + local pack the **primary** lead acquisition channel for Tri Pros Remodeling by month 12, targeting **30–60 SEO-attributed leads/month** and **$1.5–3M incremental annual revenue**, complementing (not replacing) existing telemarketing + social channels.

**Strategic frame:** Tri Pros is a small specialized SoCal residential construction team competing in the most consolidated home improvement SEO market in the US. We win not by outspending PE-backed roll-ups but by combining (a) deep local authority concentration, (b) real DB-backed project evidence per page, (c) human-psychology-driven conversion design, and (d) early adoption of AI/LLM citation infrastructure.

**Time horizon:** 12-month program with quarterly checkpoints. Authority compounds; do not pull the plug before month 4 impressions signal.

**Resource model:** In-house execution by 1 dedicated marketing operator (~20 hrs/wk) + Claude as content/strategy partner + tools (~$700/mo). No retained agency.

---

## 2. The 24 locked decisions (from strategic grilling, 2026-05-19)

These are the foundational forks that gate every downstream decision. They are NOT negotiable without explicit amendment to this doc. Each row reflects the user's actual choice during the grilling session.

| # | Decision | Locked answer | Why this matters |
|---|---|---|---|
| Q1 | Trade focus | **Kitchen + Bath + ADU** (expanded in Q4) | Highest LTV-to-CAC in residential; ADU is the hottest under-served SoCal vertical |
| Q2 | Service area scope | **Tight 15 anchor cities**, expand later | HCU-defensible; avoids thin-content penalty on a new domain |
| Q3 | Geographic anchor | **LA Westside + SFV + SGV + Antelope Valley + IE** within 35-mi radius of 91335 (Reseda) | Operational reality + halo coverage |
| Q4 | Trade matrix | **5 trades × 15 cities = 75 cells** (K + B + ADU + Addition + Garage Conversion) | Best balance of competition + bundling |
| Q5 | URL / IA architecture | **`/trades/[trade]/[city]` for SEO + `/services/[positioning]` for brand** | User's reframing: services = positioning, trades = construction discipline |
| Q6 | Execution model | **In-house + Claude + tools** (~$700/mo budget) | Tech-capable shop = unfair advantage; full quality control |
| Q7 | Role of SEO + Mo-12 target | **Primary channel; 30–60 leads/mo; $1.5–3M incremental annual revenue** | Anchored to real unit economics |
| Q8 | Conversion architecture | **Differentiated full-stack**: sticky CTA, 4-field form, city-specific social proof, cost calculator, real photo gallery, reviews carousel, financing tile, FAQ, self-serve booking, route to existing intake | 10–15% conversion (vs. industry avg 1–3%) |
| Q9 | GBP foundation | **SAB (Service-Area Business)** with hidden Reseda residential address + 15-city service area | Honest answer to physical-presence reality |
| Q10 | Reviews engine | **Steady 3–5/mo, custom in-house build** on existing QStash + customer-pipeline stack | Compounding moat; $0 tool cost |
| Q11 | Content engine approach | **DB-driven programmatic at scale** with mitigations (Strategic Hybrid per Q13) | Leverages projects DB as a structural moat |
| Q12 | DB density audit | **Sparse** — 39 public projects across 35 cities; 9 of 15 anchor cities empty | Real data → adjusted to Path C below |
| Q13 | Anchor cities + tiering path | **Path C: Strategic Hybrid** — Tier 1+2 deep, Tier 3 selective by DB evidence + Path 3 Hybrid (10 Westside/SFV/SGV + 4 IE + 1–2 halo) | Lowest risk + fastest revenue |
| Q14 | Tracking architecture | **Full L1+L2+L3 immediately; L4 server-side multi-touch in months 4–6** | Closes attribution loop search → revenue |
| Q15 | AI/LLM SEO investment | **Heavy**: Q&A content + schema + Reddit/Quora + digital PR outreach | Captures the under-40 conversational search shift |
| Q16 | Link building approach | **Hybrid**: BrightLocal citations + DIY HARO + partner outreach + sponsorships + digital PR | Defensible against penalty risk |
| Q17 | Blog cadence | **Moderate: 3–4 posts/mo, 2,000–3,500 words, topic-clustered** | Quality > quantity for new domain |
| Q18 | Phasing | **Authority-first + Aggressive**: Tier 1 by mo 2, Tier 2 by mo 3, matrix in parallel | Best long-term compounding |
| Q19 | KPIs + reporting | **Full leading + lagging stack**; weekly standup + monthly review + defined kill criteria | Catches problems early; prevents premature shutdown |
| Q20 | Roles model | **Concentrated**: 1 internal marketing operator at 20+ hrs/wk | User's choice; single-point-of-failure risk flagged |
| Q21 | 30-day sprint pace | **As-specified Aggressive** — foundation + 5 Tier 1 + 6 city hubs + reviews + first blog by day 30 | Maximum momentum |
| Q22 | Investment envelope | **Lean ($700/mo tools, in-house labor)** with user + Claude as specialist freelancers | Reframed mid-grilling |
| Q23 | Paid stacking | **LSAs at $1.5k/mo from mo 1; Google Ads search added mo 3–6** | Synergistic with SEO infrastructure |
| Q24 | Email/referral engine | **Deferred to Phase 2 trigger**: 20+ closed deals OR month 9 (whichever first) | Focus over sprawl |

### Post-grilling decisions

- **Anchor 15 final list (v3, after Santa Monica → Palmdale swap):**
  ```
  Encino, Tarzana, Sherman Oaks, Studio City, Woodland Hills, Calabasas,
  Burbank, Glendale, Pasadena, Palmdale, Beverly Hills,
  Upland, Fullerton, Pomona, Rancho Cucamonga
  ```
- **GBP path:** Legacy listing with reviews exists and will be claimed via Request Access (rather than continuing with the new submission). All playbook GBP config applies to legacy listing post-ownership transfer.

---

## 3. Strategic foundation

### 3.1 Who we serve

**Customer:** SoCal homeowner, owner-occupied SFH, household income $150k+, considering or actively planning a $30k–$400k home remodel. Primary trade interests: kitchen, bath, ADU, home addition, garage conversion.

**Geographic concentration:** SFV + SGV + Westside + Antelope Valley + IE (the 15 anchor cities). Within those, owner-occupied SFH neighborhoods are the priority.

**Buying journey we target:**
1. *Awareness:* "is my kitchen worth remodeling" / "what's an ADU" — blog, AI/LLM citations
2. *Research:* "kitchen remodel cost in Encino" — cost guides, Tier 2 city hubs
3. *Shortlisting:* "best ADU builder Sherman Oaks" — Tier 1 + Tier 3 pages, local pack
4. *Conversion:* contractor evaluation, free estimate request — conversion architecture
5. *Decision:* in-home meeting → proposal → close (telemarketing/sales playbook owns this)

SEO produces leads pre-warmed through stages 1–4. Sales team takes over at 5.

### 3.2 What we deliberately do NOT do

Avoiding feature creep is as important as picking the right features. Off-limits unless explicitly amended here:

- ❌ Roofing, window replacement, solar — dominated by PE-backed national lead-gen brokers
- ❌ Commercial projects — different customer, different SERP
- ❌ Whole-home additions as a lead channel — referral business, low search volume
- ❌ Outdoor living / patios — landscape-design competitor turf
- ❌ Multi-trade generalist positioning — diluted authority
- ❌ More than 20 anchor cities in year 1 — HCU risk
- ❌ Paid link buying / PBN tactics — penalty risk

### 3.3 What "winning" looks like at key checkpoints

| Checkpoint | Lagging indicator (revenue) | Leading indicators |
|---|---|---|
| **Month 3** | 0–5 SEO leads; not yet visible | 500 organic sessions; 10 keywords top 10; 15K GSC impressions; foundation tools live |
| **Month 4** | Still building | **30K+ GSC impressions/mo** (the canary — see §7.2) |
| **Month 6** | 10–20 SEO leads/mo | 3K sessions; 60 keywords top 10; 40 reviews; 1–2 press placements |
| **Month 9** | 20–40 SEO leads/mo | 7K sessions; 120 keywords top 10; 60 reviews; multiple 3-pack positions |
| **Month 12** | **30–60 SEO leads/mo** | **10K sessions; 200 keywords top 10; 80 reviews; AI/LLM citations active** |

If month 4 impressions are below 10K, structural problem — diagnose immediately. If month 9 trajectory says we'll hit <50% of mo-12 target, layer paid amplification.

---

## 4. Tactical architecture

### 4.1 Trade × city matrix (75 cells)

```
                Encino  Tarzana  ShermanOaks  StudioCity  WoodlandHills  Calabasas  Burbank  Glendale  Pasadena  Palmdale  BeverlyHills  Upland  Fullerton  Pomona  RanchoCuc.
Kitchen          ✓        ✓          ✓            ✓           ✓             ✓          ✓         ✓         ✓         ✓          ✓            ✓        ✓          ✓        ✓
Bathroom         ✓        ✓          ✓            ✓           ✓             ✓          ✓         ✓         ✓         ✓          ✓            ✓        ✓          ✓        ✓
ADU              ✓        ✓          ✓            ✓           ✓             ✓          ✓         ✓         ✓         ✓          ✓            ✓        ✓          ✓        ✓
Home Addition    ✓        ✓          ✓            ✓           ✓             ✓          ✓         ✓         ✓         ✓          ✓            ✓        ✓          ✓        ✓
Garage Conv.     ✓        ✓          ✓            ✓           ✓             ✓          ✓         ✓         ✓         ✓          ✓            ✓        ✓          ✓        ✓
```

**Per Strategic Hybrid (Path C):** Tier 3 cells only ship when DB has ≥1 real project for that (trade, city) cell. Empty cells stay deferred until DB grows.

**Initial Tier 3 launch set (cells with current DB evidence — to be confirmed via DB query):**
- Encino: Kitchen, ADU (1 project each)
- Tarzana: Kitchen (1 project)
- Sherman Oaks: Kitchen (1 project)
- Burbank: Kitchen (1 project)
- Glendale: Kitchen, Bath, ADU (3 projects total)
- Woodland Hills: Kitchen (1 project)
- Beverly Hills: Kitchen (1 project)
- Fullerton: Kitchen, Bath (3 projects total)
- Upland: Kitchen, Bath (3 projects total)
- Pomona: Bath (2 projects)
- Rancho Cucamonga: Kitchen, Bath (2 projects total)

**Cells deferred until DB fills:**
- Studio City, Calabasas, Pasadena, Palmdale: zero projects currently
- All ADU/Addition/Garage cells except Encino-ADU

### 4.2 URL architecture (locked per Q5)

```
PUBLIC SEO SURFACES
  /                                                  Home (priority 1.0)
  /trades/[trade]                                    Tier 1 — head-term trade pages
  /trades/[trade]/[city]                             Tier 3 — programmatic matrix cells
  /areas/[city]                                      Tier 2 — city hub pages (decision: see below)
  /services/luxury-renovations                       Brand positioning page
  /services/energy-efficient-construction            Brand positioning page
  /portfolio                                         Portfolio index
  /portfolio/projects/[accessor]                     Individual project case studies
  /blog                                              Blog index
  /blog/[slug]                                       Individual blog posts (NEW route — needs to be built)
  /about, /contact, /experience, /privacy            Standard pages

PRIVATE (DISALLOWED IN robots.txt)
  /dashboard/*    /intake/*    /proposal-flow/*    /auth-flow/*    /tests/*    /admin/*    /api/*
```

**Trade slugs (canonical):**
- `kitchen-remodeling`
- `bathroom-remodeling`
- `adu-construction` (also captures "ADU builder" + "ADU contractor")
- `home-addition`
- `garage-conversion`

**City hub URL decision pending:** `/areas/[city]` vs `/cities/[city]` vs `/[city]`. Recommendation: `/areas/[city]` — most semantically clean; reads as "areas we serve / city." Lock at sprint week 2 when route is built.

### 4.3 Content tier specifications

#### Tier 1 — Trade head pages (5 pages, hand-crafted)

| Spec | Target |
|---|---|
| Word count | 3,000–4,000 words |
| Primary keyword | `[trade] Los Angeles` / `[trade] Southern California` (long-tail) + `[trade]` (head) |
| Sections required | Hero + value prop, What we do, Process + timeline, Pricing range (with calculator), Project showcase (3+ real projects), FAQ (10+ Q&A), Author bio, Internal links to all 15 cities, CTAs |
| Schema | Service + LocalBusiness + Person (author) + FAQPage + Breadcrumb |
| Build effort | ~12–20 hours each (Claude drafts, you enrich + approve) |

#### Tier 2 — City hub pages (15 pages, hand-crafted)

| Spec | Target |
|---|---|
| Word count | 2,000–2,500 words |
| Primary keyword | `remodeling contractor [city]` / `[city] remodeling company` |
| Sections required | Hero with city name + value prop, About this city (housing stock, common floor plans, permit notes), All 5 trades we serve here (with internal links to Tier 3 cells), Project showcase (real DB pull), City-tagged testimonials, FAQ specific to this city, CTAs |
| Schema | LocalBusiness + Place + Service (per trade) + FAQPage + Breadcrumb |
| Build effort | ~6–10 hours each |

#### Tier 3 — City × trade cells (15–25 initial, expanding)

| Spec | Target |
|---|---|
| Word count | 1,500–2,500 words |
| Primary keyword | `[trade] [city]` / `[trade] in [city]` |
| Sections required | Hero (H1 = `[Trade] in [City]`), City-specific intro (200–300w, real local knowledge), Real project gallery (DB-pulled, filtered by city + trade), City-specific pricing range + calculator, Permit info, Common challenges, City-tagged testimonials, FAQ specific to this trade × city, CTAs |
| Schema | Service + LocalBusiness + FAQPage + ImageObject (per project) + Breadcrumb |
| Build effort | ~2–3 hours each (template-driven + per-cell enrichment) |

#### Cost guide pages (5 — one per trade)

Hybrid blog/landing. Live at `/blog/[slug]` with `?topic=cost-guide` filter capability. Heavy commercial intent. Highest single-post traffic source after Tier 1.

#### Blog posts (3–4/mo, ~40 by month 12)

Topic-clustered around the 5 Tier 1 pillars. Each cluster gets 8–10 posts over year 1 covering: cost guides, permit guides, comparison content, FAQ deep-dives, mistake lists, design trends, case studies, regulatory analysis.

### 4.4 Schema markup bundle

Auto-generated from DB data via shared schema components. Every page in the matrix gets:

```jsonld
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "LocalBusiness", ... },
    { "@type": "Service", ... },
    { "@type": "FAQPage", ... },
    { "@type": "BreadcrumbList", ... },
    { "@type": "ImageObject", ... per project image },
    { "@type": "AggregateRating", ... pulled from GBP reviews API daily }
  ]
}
```

Person/Author schema added to Tier 1 + cost guides (E-E-A-T signal).

### 4.5 GBP architecture (locked per Q9 + post-grilling)

**Status:** Legacy listing claim path. All config below applies to the LEGACY listing once ownership transfers via Request Access.

**Business model:** SAB (Service-Area Business). Reseda residential address HIDDEN. 15-city service area listed by name.

**Categories:**
- Primary: `Remodeler`
- Secondary (in priority order):
  1. `General Contractor`
  2. `Kitchen Remodeler`
  3. `Bathroom Remodeler`
  4. `Construction Company`
  5. `ADU Builder` (or `Custom Home Builder` if ADU Builder unavailable)
  6. `Home Improvement Store` (yes, even without storefront — extra trigger surface)

**Services list:** 25–40 custom service entries combining trade × city, each with a 200–300 character description. Example: `"Kitchen Remodeling in Encino" — "Custom kitchen remodels for Encino homeowners, including layout redesigns, custom cabinets, and energy-efficient upgrades. Permit handling and project management included. Licensed CSLB."`

**Service area:** 15 anchor cities listed by name (NOT radius). See appendix for ZIPs (used in LSAs / GeoTargeting elsewhere).

**Posts cadence:** Weekly. Use **Offer type** preferentially (7-day prioritization in local pack carousel) over Update type.

**Photos:** 30+ at launch; 3–5 fresh weekly. All geo-tagged with EXIF intact. Descriptive filenames (`encino-kitchen-remodel-tri-pros-2026-04.webp`).

**Q&A:** Pre-seed 12–15 questions answered by official @business label. Defends Q&A real estate from competitor hijacking.

**Messaging:** ON, 2-hour SLA, route to existing intake.

**Booking integration:** Connected to schedule-management feature.

**"From the business" description:** Version A (locked):
> Tri Pros Remodeling is a family-led residential construction company serving Southern California homeowners across the San Fernando Valley, San Gabriel Valley, and Greater Los Angeles area. We specialize in kitchen and bathroom remodels, ADU and garage conversions, and home additions for owners who want a contractor that listens before quoting. Every project is led by a dedicated project manager, backed by a small team of construction, finance, and design specialists. Every estimate comes with a written scope of work and a clear timeline. Our process is built on understanding what you actually need — not pushing what we want to sell. Licensed, bonded, and insured in California.

**Attributes:** Family-owned, Small business, Languages spoken (Spanish, Armenian, Persian/Farsi, Russian, Hebrew — confirm what team actually speaks).

### 4.6 Reviews engine (locked per Q10)

**Velocity target:** Steady 3–5 new Google reviews per month, sustained for 12 months. Mo-12 target: 70+ Google reviews total.

**Architecture:** Custom in-house, built on existing infrastructure:
- **Trigger:** QStash job fires 24h after meeting status hits `project-complete`
- **Pulse intercept:** SMS with NPS 1–10 question
  - Score 9–10 → Google review link (highest-weighted platform)
  - Score 7–8 → Yelp / Houzz review link (diversification)
  - Score ≤6 → internal feedback form (no public ask)
- **Re-nudge:** 72h email follow-up if no response
- **Fallback:** Day 7 manual ask routed to PM
- **Response automation:** Sentiment-classified template drafts, owner reviews + sends within 24h SLA

**Multi-platform routing:**
- Google primary (90% weight)
- Yelp (slow-drip — max 1 review per 2 weeks to avoid filtering)
- Houzz (industry-relevant)
- BBB (trust signal)

**Review monitoring:** Daily check across all platforms, auto-flag for response in agent dashboard.

**Review keyword seeding:** Sales/PM team trained to ask "How did your [trade] in [city] go?" — customers often echo phrasing in reviews. Subtle, not dictated.

### 4.7 Conversion architecture (locked per Q8)

Every SEO landing page (Tier 1, Tier 2, Tier 3) gets the full stack:

1. **Mobile sticky bottom bar:** Call + Text + "Get Free Estimate" (3-way)
2. **Above-fold hero:** H1 (trade + city), 1-line value prop, 4-field form (name/phone/project/ZIP), trust bar (license # + insured + 5★ × N reviews + years), real project photo from that city
3. **City-specific social proof block:** "X+ completed projects in [City]" with project pin map
4. **Cost calculator widget:** "Estimate your [trade] cost in [city] in 60 seconds" — engagement tool + lead capture
5. **Real photo gallery:** Pulled from projects DB, filtered by city + trade
6. **Reviews carousel:** Fresh from Google Reviews API daily
7. **Financing tile:** Separate intent path from estimate CTA
8. **FAQ section:** 8–12 questions, FAQPage schema
9. **Self-serve booking modal:** Hooked to schedule-management feature

**Target page-level conversion rate:** 10–15% (vs. industry avg 1–3%).

**Lead routing:** All SEO conversions route to existing intake with `lead_source=seo-organic` + page/city/trade as metadata. Sales team applies inbound SLA (faster than telemarketing cold-call follow-up).

### 4.8 Tracking + attribution (locked per Q14)

**L1 — Free basics (mo 1):**
- GA4 with enhanced ecommerce on form fills, key events as conversions
- GSC linked, sitemap submitted
- GBP Insights for local pack tracking
- Bing Webmaster Tools (1-click GSC import + IndexNow protocol)

**L2 — Call tracking (mo 1):**
- CallRail account with DNI pool (~10 numbers initial)
- Source/keyword/landing-page attribution per call
- Whisper messages: "This call came from your [page] page" for sales context
- Recordings (CA-compliant disclosure) — real customer language feeds copy iteration
- Webhook into intake/lead-sources-admin

**L3 — Lead-source ingest (mo 1):**
- Extend `lead-sources-admin` with new fields: `utm_source`, `utm_medium`, `utm_campaign`, `landing_page`, `referrer`, `search_query`, `callrail_call_id`, `device_type`, `detected_city`
- Auto-populate from form submission + CallRail webhook
- New enum value: `seo-organic` for source
- Reporting query: leads × trade × city × source

**L4 — Multi-touch attribution (mo 4–6):**
- Server-side GA4 hits via Next.js API route
- First-touch + last-touch + linear attribution models
- Internal dashboard pulls from DB
- Closes loop: search query → page → form → meeting → proposal → closed revenue

**Conversion definition:**
> A *qualified SEO conversion* is a lead in the CRM with valid name, valid phone, valid email OR address, plus identifiable project intent, originating from organic search OR Google Business Profile. Form fills + phone calls > 90 seconds both count. Click-to-call without connection, calculator submissions without contact info, and chat sessions without lead capture are tracked as MQL signals but NOT conversions.

### 4.9 Link building (locked per Q16)

**Approach:** Hybrid — citations outsourced, contextual links DIY.

**Foundation (mo 1–2):**
- BrightLocal Citation Builder one-time service ($299) for 50–80 NAP listings
- Industry association memberships: NARI Greater LA, BBB A+, Reseda chamber

**Ongoing (mo 1+):**
- HARO / Source of Sources / Qwoted: 3–5 pitch responses/week (Claude drafts, operator approves + sends)
- Local partner outreach: 5 new conversations/month (designers, architects, suppliers, real estate agents, mortgage brokers) — featured-builder swaps
- Sponsorships: 1 local charity/event sponsorship/quarter (Habitat for Humanity, Rebuilding Together) for .org links
- Digital PR pitching: monthly outreach to LA-area publications (LA Times Real Estate, Voyage LA, Patch SFV, Hoodline, Spectrum News 1) with story angles

**Targets:**
| Time | Referring domains |
|---|---|
| Month 3 | 30–40 |
| Month 6 | 50–70 |
| Month 12 | 90–140 |
| Month 18 | 150–220 |

**Banned tactics:** link buying on Fiverr, PBNs, press release distribution services, comment spam, generic directory packages, reciprocal link farms.

### 4.10 AI / LLM SEO (locked per Q15)

**Investment level:** Heavy. ~25–30% extra content effort vs. traditional SEO. The window is open; competitors aren't doing this.

**Tactics:**
1. **Natural Q&A format** in every page body, optimized for LLM citation pulls
2. **Quantifiable claims** ("Tri Pros completed 39+ public projects across SoCal, including kitchens in Encino, ADUs in Sherman Oaks, and bath remodels in Glendale") — LLMs prefer specific, falsifiable claims
3. **Cited authoritative sources** — outbound links to .gov / .edu / manufacturer specs / industry standards
4. **Schema markup density** — FAQPage + Service + LocalBusiness + Review + AggregateRating + Person on every relevant page
5. **Brand mention frequency** — Reddit + Quora participation, digital PR campaigns
6. **Author authority signals** — first-person bio boxes with credentials, photo, social proof
7. **`/llms.txt` manifest** — emerging standard, increasingly respected
8. **Press placements** in regional + industry pubs — disproportionate LLM entity-graph influence

**Targets:**
- Mo-3: 0–1 LLM citations tracked (across ChatGPT, Perplexity, Gemini)
- Mo-6: 3–5 citations
- Mo-12: 15+ citations

**Monitoring:** Monthly manual queries on ChatGPT / Perplexity / Gemini / Claude with target phrases: "best ADU builder in Encino" / "kitchen remodeler in Sherman Oaks" / etc. Log appearances.

### 4.11 Paid stacking (locked per Q23)

**Month 1:** Launch LSAs (Local Service Ads) at **$1.5k/mo** budget.
- Shares GBP reviews + license verification (once legacy listing claimed)
- "Google Guaranteed" badge lifts trust on both channels
- Lead routing into existing intake
- Expected CPL: $30–150 (drops as reviews + age accrue)

**Months 3–6:** Layer Google Ads search.
- Avg CPC for "kitchen remodel" SoCal: $15–40
- Landing pages already conversion-optimized (Tier 1 + Tier 2 + Tier 3)
- Expected effective CPL: $200–600
- Use Performance Max for retargeting

**NOT doing (yet):** Meta ads, YouTube ads, programmatic display. Add in year 2 if SEO + LSA + Search Ads proves the funnel.

### 4.12 Email + referral engine (DEFERRED per Q24)

**Phase 2 trigger:** Spin up when SEO produces 20+ closed deals OR month 9 hits, whichever first.

**Scope when spun up:**
- Lead magnets (cost guide PDFs, ADU permit checklist) → email capture
- 5-email welcome nurture sequence
- Quarterly newsletter
- Past-customer referral program ($500 referral incentive)
- Milestone touchpoints (1-year, 3-year project anniversaries)
- Reputation monitoring (Google Alerts on brand + competitors)

**Tools:** Existing Resend + React Email + customer DB + QStash. $0 new tool cost.

---

## 5. Tool stack

See [`tool-stack.md`](./tool-stack.md) for full ranked list with paid/free, pros/cons, setup, and where-to-look cheat sheet. Summary:

```
TIER 1 (Mandatory)         GSC · GA4 · GBP · Ahrefs Standard · CallRail
TIER 2 (Highly recommended) Local Falcon · Screaming Frog · BrightLocal · Bing WMT
TIER 3 (Recommended)        Google Trends · Vercel Analytics · Cloudflare

Monthly recurring: ~$435/mo (well under $700 ceiling)
One-time year 1:  $299 (BrightLocal Citation Builder)
Annual:           $259/yr (Screaming Frog)
```

---

## 6. Operating model

### 6.1 Roles (locked per Q20)

**Concentrated model:** 1 internal marketing operator carries 70%+ of execution.

**Allocation:**

| Activity | Owner | Cadence | Hrs/wk |
|---|---|---|---|
| Content drafting | Claude drafts → operator reviews + approves | Daily | 4–6 (operator) |
| Local enrichment (city facts, permits, photos) | Operator (local knowledge) | Daily | 2–4 |
| Page publishing + technical sign-off | Operator | After each draft cycle | 1–2 |
| GBP weekly post + photo upload | Operator | Fridays | 0.5 |
| Review responses (within 24h) | Operator + Claude drafts | Daily | 1–2 |
| HARO/SOS pitch responses | Claude drafts → operator edits + sends | 3–5/wk | 2 |
| Local partner outreach | Operator (relationships) | 2–3/wk | 2–3 |
| Citation monitoring | BrightLocal auto + operator spot-check | Monthly | 0.5 |
| CallRail recording review | Operator (sales team helpful) | Weekly batch | 1 |
| Weekly KPI standup | Operator + sales lead | Monday 15-min | 0.25 |
| Monthly KPI review + sprint plan | Operator + Claude + sales lead | First Wed of month | 1 |
| Tech / dev work | Operator + dev capacity | Mostly mo 0, then 5–10/mo ongoing | varies |
| Photography | Operator + PMs | As projects complete | varies |
| Customer ask flow training | Sales + PMs | Project completion | varies |
| Subreddit / Quora answers | Operator + designated brand voice | 1–2/wk | 1 |

**Total realistic ongoing internal time commitment:** 20–25 hrs/week sustained. Front-loaded heavier in months 0–3 (~30 hrs/wk including content sprint).

**⚠️ Single-point-of-failure risk:** Locked-in concentrated model means if the operator leaves or is unavailable, the program degrades fast. Mitigations:
- Over-document via this playbook + GH issues
- Train a second person on critical workflows (review responses, GBP posts)
- Backup operator on retainer (~$1k/mo for emergency coverage)

### 6.2 Cadence

**Daily (lightweight):**
- Ahrefs rank monitor + Local Falcon (auto-alert on big drops)
- New review monitoring across platforms
- HARO/SOS inbox check

**Weekly (15-min standup, Monday):**
- GSC clicks/impressions delta
- New reviews count
- Links earned (BrightLocal monitor + Ahrefs alerts)
- Content shipped + scheduled
- Blocker review

**Monthly (60-min review, first Wednesday):**
- Full KPI table review (see §7)
- Content backlog grooming
- Next-month sprint plan
- Budget actuals vs. plan

**Quarterly (deep dive):**
- Cohort analysis (which months' pages produce most leads)
- Content refresh decisions (top-performing posts get updated)
- Strategic pivots if any
- Year-end planning at Q4 review

### 6.3 Decision hierarchy

When in doubt:
1. **User business decisions in §2 are non-negotiable.** Open a discussion thread on the ROOT issue to amend.
2. **Playbook architectural choices (§4) are non-negotiable for tactical work.** Open discussion thread to amend.
3. **Within those, operator + Claude make tactical execution decisions** without escalation.
4. **Conflicts between playbook and DOCS.md / codebase conventions:** the more specific doc wins. Search for the slug in `// see <path>/DOCS.md#slug` references.

---

## 7. KPIs, reporting, kill criteria (locked per Q19)

### 7.1 KPI stack

```
LAGGING (the goals — but they trail real progress by 90-180 days)
  • SEO-attributed leads / month         (target: 30-60 by mo 12)
  • SEO-attributed closed deals / month  (target: 5-10 by mo 12)
  • SEO-attributed revenue               (target: $1.5-3M annualized by mo 12)
  • CPL from SEO (tools cost / leads)    (target: <$30 per lead by mo 6)

LEADING (the proof — monthly tracking)
                                         Mo 3 / Mo 6 / Mo 12
  Traffic
    Organic sessions/mo                   500 / 3,000 / 10,000
    Branded vs non-branded split          30/70 → 20/80 → 15/85
    GSC clicks/mo                         300 / 2,000 / 7,000
    GSC impressions/mo                    15K / 80K / 300K  ⭐ canary

  Rankings
    Keywords ranking top 10               10 / 60 / 200
    Keywords ranking top 3                2 / 15 / 60
    Local pack 3-pack positions           0 / 4-7 / 12-20

  Authority
    Domain rating (Ahrefs DR)             ~10 / ~22 / ~35
    Referring domains                     40 / 70 / 130
    Google reviews                        30 / 50 / 80
    LLM citations (CGPT/Perp/Gem)         0-1 / 3-5 / 15+

  Content velocity
    Tier 1 pages live                     5 / 5 / 5
    Tier 2 city hubs live                 15 / 15 / 15
    Tier 3 matrix cells live              15 / 30 / 60
    Blog posts published                  9-12 / 21-24 / 40+

  Conversion
    Page-level conversion rate            3% / 6% / 10%+
    Phone calls/mo (CallRail)             10 / 60 / 200
    Mobile vs desktop conv split          Tracked; gaps optimized
```

### 7.2 The canary indicator

**GSC impressions at month 4** predicts mo-12 outcome better than any single metric:
- **30K+ impressions/mo at mo-4** → on track for primary-channel target
- **10K–30K impressions/mo at mo-4** → tactical issues; diagnose + adjust
- **<10K impressions/mo at mo-4** → structural problem; emergency review

### 7.3 Kill criteria

These are **diagnostic triggers, not termination conditions.** Most agencies hide kill criteria because their interests favor extending engagements. Ours are explicit:

| If by this month... | This is true... | Action |
|---|---|---|
| **Month 3** | <500 organic sessions AND <20 keywords in top 100 | Diagnose: technical SEO (indexation/schema/CWV). Fix and re-evaluate at mo 4. |
| **Month 6** | <1,500 sessions AND no movement on tracked keywords | Pivot content type: maybe wrong intent layer. Re-evaluate keyword strategy. |
| **Month 6** | 0 SEO-attributed leads (with proper tracking confirmed working) | Pivot conversion: problem isn't SEO, it's the funnel. Audit page-level conversion. |
| **Month 9** | Trajectory says we'll hit <50% of mo-12 target | Layer paid amplification: stack LSA + Google Ads + remarketing more aggressively. |
| **Month 12** | <10 SEO-attributed leads/mo AND <30 ranking top-10 | Strategic review: something deeper is wrong. Honest reset conversation. |

---

## 8. Industry-insider alpha pack

12 secrets most contractors never hear. Apply liberally.

| # | Secret | Application |
|---|---|---|
| 1 | **GSC "Pages" report filtered for high-impressions/low-CTR is the highest-ROI optimization in SEO.** | Monthly from mo-3: rewrite weak titles/metas on these pages → 2–5x CTR uplift for zero new content. |
| 2 | **GBP "Offer" posts stay prioritized in local pack carousel for ~7 days; "Update" expires within hours.** | Always use Offer type. Same content, dramatically different visibility. |
| 3 | **Pre-seed your own GBP Q&A.** | Add 12–15 questions yourself, answered with @business label. Defends Q&A real estate from competitors. |
| 4 | **Image filenames + EXIF geo-tagging** | `encino-kitchen-remodel-tri-pros-2024-03.webp` outperforms `IMG_1234.jpg`. EXIF coordinates boost proximity weight. 8–15% bonus from image SEO. |
| 5 | **Force indexation via GSC URL Inspection "Request Indexing"** | Cuts time-to-rank by 7–14 days vs. organic crawl. Apply to every new Tier 1, Tier 2, Tier 3 page. |
| 6 | **CallRail recordings are content gold.** | Real customers say "we want to redo our kitchen," not "kitchen remodeling." Reverse-engineer copy from actual transcripts. |
| 7 | **Review keyword seeding (subtle).** | Ask "How did your kitchen remodel in Encino go?" — customers echo phrasing. Reviews with keyword matches rank that page better. |
| 8 | **AI Overview-friendly opening paragraphs.** | Lead each page with quantifiable answer in first 100 words. "A kitchen remodel in Encino in 2026 typically costs $65k–$140k" → cited. Vague → ignored. |
| 9 | **Bulk competitor backlink audit (Ahrefs).** | Dump every site linking to top 5 SoCal competitors → filter for feasible outreach. 60–80% of your link prospecting list, pre-validated. |
| 10 | **Local Falcon geo-grid rank tracking.** | "You rank #3 in Encino" is wrong granularity. Local Falcon shows you rank #1 in north Encino, #8 in south. Surgical targeting. |
| 11 | **Yelp slow-drip rule.** | Yelp suppresses reviews arriving in bursts (filtered). Plan ~1 Yelp review per 2 weeks max. Different cadence from Google (where velocity helps). |
| 12 | **Programmatic SEO survives only if pages have unique *entities*, not just unique *words*.** | This is why we built Strategic Hybrid (Path C). Cells without DB evidence don't ship. The moment you ship a city page with no real project, you've crossed into spam territory. |

---

## 9. Appendices

### 9.1 Anchor 15 — city + ZIP reference

```
HQ (Reseda, for reference)         91335

SFV / SGV (9)
  Encino                           91316, 91436
  Tarzana                          91356
  Sherman Oaks                     91403, 91423
  Studio City                      91604
  Woodland Hills                   91364, 91367
  Calabasas                        91302
  Burbank                          91501, 91502, 91504, 91505, 91506
  Glendale                         91201, 91202, 91203, 91204, 91205, 91206, 91207, 91208
  Pasadena                         91101, 91103, 91104, 91105, 91106, 91107, 91108

ANTELOPE VALLEY (1)
  Palmdale                         93550, 93551, 93552

HALO — Westside premium (1)
  Beverly Hills                    90210, 90211, 90212

IE — EVIDENCE-BACKED (4)
  Upland                           91784, 91786
  Fullerton                        92831, 92832, 92833, 92835
  Pomona                           91766, 91767, 91768
  Rancho Cucamonga                 91701, 91730, 91737, 91739
```

**44 unique ZIP codes total.** Used in: LSA geo-targeting, Google Ads, Local Falcon grids, schema `areaServed.postalCode`, internal CRM lead routing.

**GBP service area entry:** Use city NAMES, not ZIPs (Google's official recommendation).

### 9.2 Where to use what

| System | Use city names | Use ZIPs |
|---|---|---|
| GBP service area | ✅ | ❌ |
| LSAs | ❌ N/A | ✅ |
| Google Ads geo-targeting | ✅ optional | ✅ preferred |
| Local Falcon rank grids | — | ✅ (one grid per city) |
| JSON-LD `areaServed` | ✅ `name` | ✅ `postalCode` |
| Internal CRM lead routing | ✅ | ✅ |
| Footer "Areas We Serve" links | ✅ | ❌ |

### 9.3 Glossary

| Term | Definition |
|---|---|
| **SAB** | Service-Area Business — GBP type where address is hidden, service area is listed by city/region |
| **3-pack / Local pack** | The three map-result business listings at the top of local-intent SERPs |
| **DNI** | Dynamic Number Insertion — CallRail tech that shows each visitor a unique tracked phone number |
| **HCU** | Helpful Content Update — Google's classifier that downranks low-value templated content (Sept 2023, March 2024) |
| **E-E-A-T** | Experience, Expertise, Authoritativeness, Trust — Google's quality framework |
| **NAP** | Name, Address, Phone — the canonical business identity triplet that must match across web citations |
| **Tier 1/2/3** | Tri Pros internal: head trade pages / city hubs / city × trade cells |
| **LSA** | Local Service Ads — Google's pay-per-lead local ad format |
| **CWV** | Core Web Vitals — Google's user-experience performance metrics (LCP, INP, CLS) |
| **GBP** | Google Business Profile (formerly Google My Business) |
| **GSC** | Google Search Console |
| **MQL** | Marketing Qualified Lead — engaged but unconverted prospect |

### 9.4 Related docs

- **[`keyword-map.md`](./keyword-map.md)** — keyword targets per page tier, search volume, competitor analysis
- **[`30-day-sprint.md`](./30-day-sprint.md)** — week-by-week deliverables with acceptance criteria
- **[`competitor-analysis.md`](./competitor-analysis.md)** — top SoCal home improvement competitors per trade, gap analysis, link prospects
- **[`llm-citation-strategy.md`](./llm-citation-strategy.md)** — AI/LLM tactics, llms.txt content, Reddit/Quora playbook, digital PR target list
- **[`tool-stack.md`](./tool-stack.md)** *(future)* — full ranked tool list with setup details

### 9.5 Change log

| Date | Change | Reason |
|---|---|---|
| 2026-05-19 | Initial playbook authored | Strategic grilling session (24 forks) |
| 2026-05-19 | Anchor 15 swap: Santa Monica → Palmdale | User decision |
| 2026-05-19 | GBP path pivot: legacy listing claim vs. new submission | Discovery of pre-existing listing with reviews |

---

**End of playbook v1.**

Amendments require: (1) update this doc, (2) bump version, (3) log in §9.5, (4) post to ROOT SEO issue thread.
