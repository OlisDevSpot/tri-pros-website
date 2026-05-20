# 30-Day SEO Sprint — Tri Pros Remodeling

> **Status:** v1
> **Owner:** Internal marketing operator + Claude
> **Sprint start:** When operator + tooling budget approved (TBD)
> **Read [`playbook.md`](./playbook.md) first.**

## Why this doc

This is the concrete implementation plan for the locked playbook. Every deliverable below has:
- A specific acceptance criterion ("done = X is true")
- Dependencies on previous tasks
- An owner (Operator / Claude / Dev / Sales)
- An estimated hours field for sprint capacity planning
- A line to the GitHub issue when created

If you complete a deliverable, check the box, log the date, link the commit/PR.

---

## Sprint capacity assumptions

- **Operator availability:** 30 hrs/week sustained during sprint (front-loaded)
- **Claude availability:** unbounded for drafting/research; bottleneck is operator review time
- **Dev capacity (you):** 10–15 hrs/week for code-side work (templates, lead-sources extension, reviews engine)
- **Sprint length:** 4 weeks = ~120 operator hours + ~50 dev hours + Claude support

**If capacity drops below these:** prioritize Week 1 + Week 3 (foundation + Tier 1). Defer Week 4 city hubs to Month 2.

---

## Week 1 — Foundation infrastructure

Goal: Every piece of measurement, GBP, schema, tracking, and template is wired before any content ships. Without this, content fires into a vacuum.

### 1.1 Technical SEO audit
- [ ] **Acceptance:** Screaming Frog full crawl complete; documented in `docs/seo/audit-baseline-{date}.md` listing all 4xx/5xx, redirect chains, missing titles, duplicate metas, oversized images
- **Owner:** Operator
- **Effort:** 3 hrs
- **Dependencies:** Screaming Frog licensed
- **Issue:** [TBD]

### 1.2 GA4 install
- [ ] **Acceptance:** GA4 property live; `@next/third-parties/google` integrated in root layout; conversion events configured (form_submit, phone_call, calculator_complete, booking_complete, scroll_75); Enhanced Measurement on; linked to GSC
- **Owner:** Dev (you)
- **Effort:** 1.5 hrs
- **Dependencies:** Google account decision
- **Issue:** [TBD]

### 1.3 Bing Webmaster Tools
- [ ] **Acceptance:** Property verified via 1-click GSC import; sitemap submitted; IndexNow API enabled (Next.js API route pings IndexNow on `revalidate`)
- **Owner:** Operator + Dev (IndexNow integration)
- **Effort:** 1 hr (verification) + 2 hrs (IndexNow API integration)
- **Dependencies:** GSC already verified ✓
- **Issue:** [TBD]

### 1.4 CallRail account + DNI setup
- [ ] **Acceptance:** CallRail account active; 1 base tracked number + DNI pool of 5; tracking script deployed via GTM or direct; whisper messages configured; webhook to intake/lead-sources-admin tested with synthetic call; recordings enabled with CA-compliant disclosure
- **Owner:** Operator (account setup) + Dev (webhook)
- **Effort:** 2 hrs (account) + 3 hrs (webhook + integration)
- **Dependencies:** Lead-sources-admin extension (1.7) — can be parallel
- **Issue:** [TBD]

### 1.5 GBP request access (parallel track — non-blocking)
- [ ] **Acceptance:** Request Access filed on legacy GBP listing; reference ID captured; 7-day window calendared
- **Owner:** Operator
- **Effort:** 0.5 hr (file request) + 0.5 hr (parallel detective work)
- **Dependencies:** None
- **Issue:** [TBD]
- **Note:** GBP is a parallel track to the rest of Week 1. Sprint proceeds whether GBP resolves this week or not.

### 1.6 Vercel Analytics + Speed Insights
- [ ] **Acceptance:** Enabled in Vercel dashboard; `@vercel/analytics` + `@vercel/speed-insights` packages installed; `<Analytics />` + `<SpeedInsights />` mounted in root layout; baseline CWV captured (LCP, INP, CLS)
- **Owner:** Dev
- **Effort:** 0.5 hr
- **Dependencies:** None
- **Issue:** [TBD]

### 1.7 Lead-sources-admin extension
- [ ] **Acceptance:** Schema updated with new fields: `utm_source`, `utm_medium`, `utm_campaign`, `landing_page`, `referrer`, `search_query`, `callrail_call_id`, `device_type`, `detected_city`. Drizzle migration applied (dev + prod). Form submission auto-populates these from URL params + cookie + CallRail webhook. New enum value `seo-organic` added to source enum.
- **Owner:** Dev (you)
- **Effort:** 4 hrs (schema + migration + form integration + tests)
- **Dependencies:** None
- **Issue:** [TBD]

### 1.8 llms.txt manifest
- [ ] **Acceptance:** `/llms.txt` file at site root, listing all Tier 1, Tier 2, and key blog URLs with brief descriptions per emerging spec ([llmstxt.org](https://llmstxt.org/)). Served via Next.js route handler.
- **Owner:** Dev (route) + Claude (content)
- **Effort:** 1 hr
- **Dependencies:** Anchor URL list confirmed
- **Issue:** [TBD]

### 1.9 Schema bundle component
- [ ] **Acceptance:** Reusable React component(s) in `src/shared/components/seo/schema/` for: `LocalBusiness`, `Service`, `FAQPage`, `Breadcrumb`, `Person` (author), `ImageObject`, `AggregateRating`. Each auto-pulls from DB or accepts props. Validates against [schema.org validator](https://validator.schema.org/) + Google Rich Results Test.
- **Owner:** Dev + Claude (schema research)
- **Effort:** 6 hrs
- **Dependencies:** Decision on JSON-LD vs. microdata (recommend JSON-LD — Google's preferred)
- **Issue:** [TBD]

### 1.10 BrightLocal Citation Builder launch
- [ ] **Acceptance:** $299 one-time service ordered; canonical NAP record provided (name, address-hidden-for-SAB, phone, website, hours, primary category); 50–80 NAP listings queued; expected completion 30 days
- **Owner:** Operator
- **Effort:** 1 hr
- **Dependencies:** GBP claim ideally done first (so legacy listing's NAP becomes canonical), but can launch with current NAP and update if needed
- **Issue:** [TBD]

### 1.11 Cloudflare audit
- [ ] **Acceptance:** DNS records confirmed (TXT for GSC verified, no orphan records); Cloudflare Web Analytics enabled (privacy-respecting, complements GA4); Turnstile site key obtained for future form integration; email routing reviewed; DNSSEC enabled
- **Owner:** Operator (DNS) + Dev (Turnstile site key)
- **Effort:** 1.5 hrs
- **Dependencies:** None
- **Issue:** [TBD]

**Week 1 totals:** ~25 hrs (operator) + ~15 hrs (dev) + Claude support

---

## Week 2 — URL migration + programmatic template build

Goal: New `/trades/[trade]/[city]` route family exists, all schema auto-renders, all conversion components are componentized and ready for content fill.

### 2.1 Build `/trades/[trade]` and `/trades/[trade]/[city]` routes
- [ ] **Acceptance:** Routes exist as Next.js file-based dynamic routes. `generateStaticParams` pulls from a configured trade list (constants) and (for city slug) the locked anchor 15. `generateMetadata` returns full SEO meta per page (title, description, OG, canonical, robots). 404 for unknown trades/cities.
- **Owner:** Dev (you)
- **Effort:** 4 hrs
- **Dependencies:** None
- **Issue:** [TBD]

### 2.2 Build the programmatic page template
- [ ] **Acceptance:** Reusable layout for Tier 3 pages. Accepts `{ trade, city }` props. Renders: hero with H1, 4-field form, mobile sticky CTA, trust bar, city-specific intro section (CMS-fillable via Notion/inline data), real project gallery (DB-pulled, filtered by city + trade tag), cost calculator widget, reviews carousel, financing tile, FAQ block, internal links to siblings + parents, schema bundle, author bio. All non-content pieces auto-render. Content slots accept JSX or markdown.
- **Owner:** Dev + Claude (content slot copy templates)
- **Effort:** 12 hrs
- **Dependencies:** 1.9 (schema bundle), conversion components
- **Issue:** [TBD]

### 2.3 Cost calculator widget (v1: kitchen, bath, ADU)
- [ ] **Acceptance:** React component, 3 trade variants. Each accepts inputs (sq ft, finish level, scope checkboxes) → returns price range. Outputs lead form with pre-filled trade interest. Mobile responsive. Embeddable in any page via slot.
- **Owner:** Dev + Claude (pricing range research per trade × city)
- **Effort:** 8 hrs
- **Dependencies:** Pricing range research per trade
- **Issue:** [TBD]

### 2.4 Conversion components library
- [ ] **Acceptance:** `<MobileStickyCTA />`, `<TrustBar />`, `<CitySocialProof />`, `<ProjectGallery />`, `<ReviewsCarousel />`, `<FinancingTile />`, `<FAQ />`, `<AuthorBio />`, `<BookingModal />` all componentized in `src/shared/components/seo/conversion/`. Each accepts props for customization. Storybook (or simple test pages) for visual QA.
- **Owner:** Dev + Claude (default copy per component)
- **Effort:** 10 hrs
- **Dependencies:** None
- **Issue:** [TBD]

### 2.5 301 redirect map (old URLs → new)
- [ ] **Acceptance:** `next.config.js` has `redirects()` returning all 301s:
  ```
  /services/luxury-renovations/[tradeSlug] → /trades/[mapped-trade]
  /services/energy-efficient-construction/[tradeSlug] → /trades/[mapped-trade]
  ```
  Test all combinations return 301 in dev + prod.
- **Owner:** Dev
- **Effort:** 1.5 hrs
- **Dependencies:** Trade mapping table (Notion trade slugs → new flat trade slugs)
- **Issue:** [TBD]

### 2.6 Update sitemap.ts for new Tier 1/2/3 routes
- [ ] **Acceptance:** `src/app/sitemap.ts` includes all Tier 1, Tier 2, Tier 3 (initial set) routes with proper `lastModified`, `changeFrequency`, `priority`. Re-deploy → re-submit to GSC.
- **Owner:** Dev
- **Effort:** 1 hr
- **Dependencies:** 2.1
- **Issue:** [TBD]

### 2.7 Internal linking system
- [ ] **Acceptance:** Helper `getInternalLinks({ trade, city })` returns: links to other trades in same city, same trade in 3 adjacent cities, related blog posts, related projects. Used in Tier 3 template. Avoids over-optimization via non-exact-match anchor text distribution.
- **Owner:** Dev + Claude (anchor text variation rules)
- **Effort:** 3 hrs
- **Dependencies:** None
- **Issue:** [TBD]

**Week 2 totals:** ~25 hrs (dev) + ~5 hrs (operator content review) + Claude support

---

## Week 3 — Ship 5 Tier 1 trade head pages

Goal: All 5 head-term trade pages live, indexed, schema-validated.

### 3.1 `/trades/kitchen-remodeling` (3,500w)
- [ ] **Acceptance:** Page live, content per Tier 1 spec (see [`playbook.md`](./playbook.md#tier-1--trade-head-pages-5-pages-hand-crafted)). Schema validates. Submitted via GSC URL Inspection "Request Indexing". Mobile + desktop visually QA'd.
- **Owner:** Claude (draft) + Operator (review, enrich, approve, publish)
- **Effort:** 12 hrs combined (4 Claude + 8 operator)
- **Dependencies:** Week 2 template
- **Issue:** [TBD]

### 3.2 `/trades/bathroom-remodeling` (3,000w)
- [ ] **Acceptance:** Same as 3.1
- **Owner:** Same as 3.1
- **Effort:** 10 hrs combined
- **Issue:** [TBD]

### 3.3 `/trades/adu-construction` (4,000w) ← strategic priority
- [ ] **Acceptance:** Same as 3.1, plus extended sections on ADU permit process, AB 2221 + SB 9 implications, detached vs attached vs garage conversion options
- **Owner:** Same as 3.1
- **Effort:** 16 hrs combined
- **Issue:** [TBD]

### 3.4 `/trades/home-addition` (3,000w)
- [ ] **Acceptance:** Same as 3.1
- **Owner:** Same as 3.1
- **Effort:** 10 hrs combined
- **Issue:** [TBD]

### 3.5 `/trades/garage-conversion` (2,500w) ← underserved opportunity
- [ ] **Acceptance:** Same as 3.1, with emphasis on garage-to-ADU funnel
- **Owner:** Same as 3.1
- **Effort:** 8 hrs combined
- **Issue:** [TBD]

### 3.6 Cross-link Tier 1 pages
- [ ] **Acceptance:** Each Tier 1 page has natural-language internal links to the other 4 (in "related services" footer block + contextual mentions in body)
- **Owner:** Operator (post-publish pass)
- **Effort:** 1 hr
- **Issue:** [TBD]

### 3.7 Force indexation
- [ ] **Acceptance:** All 5 URLs submitted via GSC URL Inspection "Request Indexing"; status confirmed indexed within 7 days
- **Owner:** Operator
- **Effort:** 0.5 hr
- **Issue:** [TBD]

**Week 3 totals:** ~50 hrs operator + ~25 hrs Claude (combined output ~56 hrs of finished content + integration)

---

## Week 4 — Ship 6 city hubs + reviews engine + first blog post

Goal: First city-level rankings activate, reviews engine starts pulsing, first cost guide goes live.

### 4.1 Ship 6 Tier 2 city hub pages
- [ ] **Acceptance:** 6 pages live, ~2,000w each per Tier 2 spec. Prioritized cities (highest DB density first):
  - `/areas/encino`
  - `/areas/sherman-oaks`
  - `/areas/glendale` (3 DB projects — strongest)
  - `/areas/burbank`
  - `/areas/tarzana`
  - `/areas/woodland-hills`
- **Owner:** Claude (draft) + Operator (review, enrich w/ local knowledge, approve, publish)
- **Effort:** 36 hrs combined (6 × ~6 hrs each)
- **Dependencies:** Week 2 template, Week 3 Tier 1 (for internal linking targets)
- **Issue:** [TBD]

### 4.2 Reviews engine
- [ ] **Acceptance:** End-to-end:
  - QStash job fires 24h after meeting status `project-complete`
  - SMS sent to customer with NPS-1–10 question (Twilio or existing SMS provider)
  - Score 9–10 → Google review link auto-routed (with our `g.page/r/...` short link)
  - Score 7–8 → Yelp / Houzz link routed
  - Score ≤6 → internal feedback form (no public ask)
  - 72h email re-nudge if no response
  - Day-7 fallback alert to PM for manual ask
  - Auto-response templates (positive / neutral / negative) drafted and routed to operator inbox for 24h SLA approval
  - Tested end-to-end with synthetic customer
- **Owner:** Dev + Operator (templates) + Sales (training to NOT ask in person now that automation runs)
- **Effort:** 16 hrs dev + 4 hrs operator
- **Dependencies:** Existing meeting status workflow; existing customer DB; QStash account
- **Issue:** [TBD]

### 4.3 First cost-guide blog post
- [ ] **Acceptance:** `/blog/kitchen-remodel-cost-los-angeles-2026` live, ~3,000 words, proprietary data from projects DB (we analyzed 47 projects format), schema with FAQPage, cost calculator embedded, links to all 5 Tier 1 pages + several Tier 3 cells. Submitted to GSC indexing.
- **Owner:** Claude (draft) + Operator (real-data validation + approval)
- **Effort:** 8 hrs combined
- **Issue:** [TBD]

### 4.4 First HARO/SOS pitches
- [ ] **Acceptance:** 3–5 pitches sent in week 4. Topics likely available: kitchen design trends, ADU laws, contractor selection. Track responses + placements in a spreadsheet.
- **Owner:** Claude (drafts) + Operator (review + send)
- **Effort:** 3 hrs
- **Dependencies:** HARO/SOS subscription active
- **Issue:** [TBD]

### 4.5 First local partner outreach
- [ ] **Acceptance:** 4 introductory conversations initiated (1 designer, 1 architect, 1 supplier, 1 real estate agent). Goal: not links yet — just relationship.
- **Owner:** Operator (existing relationships preferred)
- **Effort:** 4 hrs
- **Issue:** [TBD]

### 4.6 Charity sponsorship outreach
- [ ] **Acceptance:** Outreach email sent to 2–3 local charity orgs (Habitat for Humanity SFV, Rebuilding Together, local school PTAs) with sponsorship proposal. Goal: 1 confirmed sponsorship by mo 2 for `.org` link.
- **Owner:** Operator
- **Effort:** 2 hrs
- **Issue:** [TBD]

### 4.7 Monthly KPI standup #1
- [ ] **Acceptance:** First end-of-sprint review. Baseline captured: GSC clicks, impressions, indexed pages, GA4 sessions, reviews count, links earned. Next-month sprint plan drafted.
- **Owner:** Operator + Claude + sales lead
- **Effort:** 1 hr meeting + 1 hr documentation
- **Issue:** [TBD]

**Week 4 totals:** ~50 hrs operator + ~20 hrs dev + Claude support

---

## Sprint-end deliverables (Day 30)

| Deliverable | Count |
|---|---|
| Tier 1 trade head pages live | 5 |
| Tier 2 city hubs live | 6 |
| Blog posts published | 1 (cost guide) |
| **Total deep pages live** | **12** |
| GBP claimed + optimized | If Request Access succeeds in 7d window; otherwise next sprint |
| Tracking layers L1+L2+L3 live | 3 |
| BrightLocal citations queued | 50–80 |
| HARO/SOS pitches sent | 3–5 |
| Partner conversations initiated | 4 |
| Reviews engine operational | Yes (first SMS pulses firing) |
| First sponsorship outreach sent | Yes |
| Foundation tools all live | Yes |

**Expected metrics at Day 30:**
- GSC indexed pages: ~25–35 (was ~7)
- Organic sessions/mo: 100–400 (very early)
- Keywords ranking in top 100: 30–80
- New reviews this month: 0–3 (engine just started)
- Referring domains: 5–15 (citation builder still running)

---

## Sprint risks + mitigations

| Risk | Mitigation |
|---|---|
| Operator capacity drops below 30 hrs/wk | Defer Week 4 city hubs to Month 2; ship Week 3 Tier 1 only |
| GBP Request Access denied | Continue sprint; escalate to Google Support; LSAs blocked but rest of program proceeds |
| Notion API instability blocks trade page deploys | Sitemap already gracefully handles; fallback to hardcoded trade list in constants |
| BrightLocal Citation Builder fails to complete in 30d | Monitor weekly; escalate to support if behind schedule |
| Reviews engine SMS deliverability issues | Test with synthetic data Day 1 of Week 4; fall back to email-only if SMS fails |
| Content quality bar slipping under time pressure | Slow down. Better to ship 4 Tier 1 + 4 city hubs at quality than 5+6 at thin |

---

## Definition of done (per deliverable)

A deliverable is "done" only when ALL of these are true:

- [ ] Acceptance criterion met (described in the deliverable)
- [ ] Code lints clean (`pnpm lint`) — for code deliverables
- [ ] Code type-checks clean (`pnpm tsc`) — for code deliverables
- [ ] Visually QA'd on mobile + desktop — for content/UI deliverables
- [ ] Linked PR merged to main (where applicable)
- [ ] Sitemap updated (if new public URLs) and re-submitted to GSC
- [ ] Indexation requested via GSC URL Inspection
- [ ] Logged in this doc with date + commit/PR link
- [ ] Schema validates ([validator.schema.org](https://validator.schema.org/)) — for content pages

If you cannot meet all conditions, the deliverable stays "in progress." Half-done deliverables in production are technical debt that compounds.
