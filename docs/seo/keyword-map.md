# Keyword Map — Tri Pros Remodeling SEO

> **Status:** v1 (initial pre-Ahrefs estimates)
> **Owners:** Internal marketing operator + Claude
> **Updated:** 2026-05-19
> **Read [`playbook.md`](./playbook.md) first.** This doc operationalizes the keyword strategy locked there.

## How to use this doc

1. **Per-page targets** are below in §3–§6. Each Tier-1/Tier-2/Tier-3 page has a primary keyword and supporting keyword cluster.
2. **Volume + difficulty estimates** here are pre-Ahrefs gut-checks based on industry benchmarks. Refine with real data once Ahrefs is live.
3. **Refinement loop:** monthly, pull GSC "Performance → Queries" data + Ahrefs Rank Tracker → update this doc → adjust on-page targeting.
4. **Don't keyword-stuff.** One primary keyword in H1 + title + URL + first 100 words. Supporting keywords appear naturally in subheadings + body. Over-optimization is penalty risk.

---

## 1. Methodology

### Sources
| Tool | Use |
|---|---|
| **Ahrefs Keywords Explorer** | Volume, difficulty (KD), SERP analysis, related/question keywords |
| **GSC Performance report** | Real queries triggering our pages (post-launch refinement) |
| **Google Trends** | Seasonality, regional interest, rising queries |
| **Google "People also ask" + autocomplete** | Long-tail discovery |
| **CallRail recordings** | Real customer phrasing (post-launch) |
| **Competitor SERP analysis** | What our top-5 SoCal competitors are ranking for (Ahrefs Site Explorer → Organic Keywords) |

### Intent classification
| Intent type | Example | Conversion rate | Page tier |
|---|---|---|---|
| **Commercial (high-intent)** | "kitchen remodel encino" / "adu contractor sherman oaks" | 8–15% | Tier 3 |
| **Commercial-informational hybrid** | "kitchen remodel cost los angeles" | 4–8% | Cost guides + Tier 1 |
| **Local navigational** | "remodeling contractor in [city]" | 6–12% | Tier 2 |
| **Informational** | "how much does a kitchen remodel cost" / "what is an ADU" | <1% direct, but TOFU funnel + LLM citations | Blog |
| **Branded** | "tri pros remodeling" | 50%+ (already convinced) | Home + About |

### Keyword research pipeline (per page, repeatable)

1. Start with the locked head term from this doc
2. In Ahrefs Keywords Explorer → enter head term + filter location California
3. Pull "Matching terms" + "Related terms" + "Questions" reports
4. Filter for KD < 30 (achievable in year 1) and volume ≥ 50/mo
5. Categorize by intent (commercial / informational / hybrid)
6. Pick 1 primary + 4–8 supporting per page
7. Log here

---

## 2. Estimated head-term volume — SoCal regional

These anchor everything. Numbers are **conservative SoCal regional estimates** based on Google Keyword Planner aggregates; Ahrefs may show 20–40% higher for the LA DMA.

| Head term | Est. SoCal monthly volume | Difficulty | Notes |
|---|---|---|---|
| `kitchen remodel` + variants | ~12,000 | High | Competitive but winnable; bundle attach magnet |
| `bathroom remodel` + variants | ~9,500 | High | High commercial intent |
| `ADU` / `granny flat` | ~7,000 | **Medium ← sweet spot** | Demand surged from AB 2221 + ADU law amendments |
| `home addition` / `room addition` | ~4,500 | Medium | Lower volume but high LTV |
| `garage conversion` | ~3,000 | **Low ← underserved** | Trojan horse to ADU conversion |
| `remodeling contractor` (generic) | ~5,500 | High | Broad — Tier 2 city hubs ranking ground |
| `kitchen remodel cost` (informational) | ~8,000 | Medium | Cost guide gold |
| `bathroom remodel cost` (informational) | ~6,000 | Medium | Cost guide gold |
| `adu cost` (informational) | ~4,000 | Low–Medium | Cost guide gold; rising trend |

### Avoided head terms (per playbook §3.2)
- `roofing` / `roof repair` — extreme competition, PE roll-ups
- `window replacement` — extreme competition, national lead-gen brokers
- `solar panel installation` — locked in by Sunrun / Tesla / regional installers
- `whole home remodel` — referral business, ~2,000/mo volume

---

## 3. Tier 1 — Trade head pages (5 pages)

These rank for the head terms above + supporting commercial-intent variations. Each is the topical-cluster pillar that all related Tier 2/3 pages + blog posts link INTO.

### 3.1 `/trades/kitchen-remodeling`

| Field | Value |
|---|---|
| **Primary keyword** | `kitchen remodeling los angeles` |
| **H1** | `Kitchen Remodeling in Los Angeles — Custom Kitchens by Tri Pros` |
| **Title tag** | `Kitchen Remodeling Los Angeles \| Tri Pros Remodeling` |
| **Meta description** | `Custom kitchen remodels across LA. Real photos, real costs, written scope of work. Licensed family-led SoCal contractor. Free estimate.` |
| **Est. volume** | ~3,000/mo (LA-modified) |
| **Difficulty** | High (KD ~50) |
| **Time to top-10** | 4–8 months |
| **Supporting keywords** | `kitchen remodel los angeles`, `kitchen remodeling contractor los angeles`, `custom kitchen remodel socal`, `kitchen renovation los angeles`, `los angeles kitchen designer`, `luxury kitchen remodel los angeles`, `energy efficient kitchen remodel` |

### 3.2 `/trades/bathroom-remodeling`

| Field | Value |
|---|---|
| **Primary keyword** | `bathroom remodeling los angeles` |
| **H1** | `Bathroom Remodeling in Los Angeles — Master Baths, Guest Baths, Wet Rooms` |
| **Title tag** | `Bathroom Remodeling Los Angeles \| Tri Pros Remodeling` |
| **Est. volume** | ~2,400/mo (LA-modified) |
| **Difficulty** | High (KD ~48) |
| **Supporting keywords** | `bathroom remodel los angeles`, `bathroom renovation los angeles`, `master bathroom remodel`, `walk in shower installation los angeles`, `bathroom contractor los angeles`, `accessible bathroom remodel`, `wet room remodel` |

### 3.3 `/trades/adu-construction`  ← **strategic priority**

| Field | Value |
|---|---|
| **Primary keyword** | `adu contractor los angeles` |
| **H1** | `ADU Construction in Los Angeles — Detached, Attached, Garage Conversions` |
| **Title tag** | `ADU Contractor Los Angeles \| Tri Pros Remodeling` |
| **Est. volume** | ~2,500/mo + rising (LA-modified) |
| **Difficulty** | **Medium (KD ~32) ← sweet spot** |
| **Time to top-10** | 3–6 months |
| **Supporting keywords** | `adu builder los angeles`, `granny flat builder`, `accessory dwelling unit los angeles`, `detached adu construction`, `attached adu`, `adu cost los angeles`, `garage conversion adu`, `prefab vs custom adu`, `adu permit los angeles`, `ab 2221 adu` |

### 3.4 `/trades/home-addition`

| Field | Value |
|---|---|
| **Primary keyword** | `home addition los angeles` |
| **H1** | `Home Additions in Los Angeles — Room Additions, Second Stories, Bump-Outs` |
| **Title tag** | `Home Addition Contractor Los Angeles \| Tri Pros Remodeling` |
| **Est. volume** | ~1,400/mo (LA-modified) |
| **Difficulty** | Medium (KD ~38) |
| **Supporting keywords** | `room addition los angeles`, `house addition contractor`, `second story addition`, `master bedroom addition`, `home addition cost los angeles`, `bump out addition`, `square footage addition` |

### 3.5 `/trades/garage-conversion`  ← **underserved opportunity**

| Field | Value |
|---|---|
| **Primary keyword** | `garage conversion los angeles` |
| **H1** | `Garage Conversion in Los Angeles — ADUs, Living Spaces, Home Offices` |
| **Title tag** | `Garage Conversion Contractor Los Angeles \| Tri Pros Remodeling` |
| **Est. volume** | ~900/mo |
| **Difficulty** | **Low (KD ~22)** |
| **Time to top-10** | 2–4 months |
| **Supporting keywords** | `garage to adu conversion los angeles`, `garage conversion cost`, `convert garage to living space`, `garage conversion permit los angeles`, `garage adu`, `attached garage conversion`, `2 car garage conversion` |

---

## 4. Tier 2 — City hub pages (15 pages)

Each city hub targets `[city] remodeling contractor` and the broader local-intent cluster. These page-level keywords are LOWER volume than Tier 1 head terms but HIGHER conversion (8–15%) because they capture decision-stage searches.

Pattern: `remodeling contractor [city]` ~150–400/mo per city in SoCal markets.

| City | Primary keyword | Est. vol/mo | KD | Supporting cluster |
|---|---|---|---|---|
| **Encino** | `encino remodeling contractor` | 250 | Low (25) | `encino remodeler`, `encino kitchen remodel`, `encino home contractor`, `91316 contractor`, `91436 contractor` |
| **Tarzana** | `tarzana remodeling contractor` | 180 | Low (20) | `tarzana home remodel`, `tarzana general contractor`, `tarzana kitchen remodel`, `91356 contractor` |
| **Sherman Oaks** | `sherman oaks remodeling contractor` | 320 | Medium (32) | `sherman oaks remodel`, `sherman oaks kitchen contractor`, `91403 contractor`, `91423 contractor` |
| **Studio City** | `studio city remodeling contractor` | 200 | Low–Med (28) | `studio city remodel`, `studio city home contractor`, `91604 contractor` |
| **Woodland Hills** | `woodland hills remodeling contractor` | 280 | Medium (30) | `woodland hills remodel`, `woodland hills home renovation`, `91364 contractor`, `91367 contractor` |
| **Calabasas** | `calabasas remodeling contractor` | 220 | Medium (35) | `calabasas luxury remodel`, `calabasas home contractor`, `91302 contractor` |
| **Burbank** | `burbank remodeling contractor` | 350 | Medium (33) | `burbank remodel`, `burbank general contractor`, `91505 contractor` |
| **Glendale** | `glendale remodeling contractor` | 400 | Medium (36) | `glendale remodel`, `glendale home renovation`, `glendale armenian contractor` (language match), `91205 contractor` |
| **Pasadena** | `pasadena remodeling contractor` | 380 | Medium–High (40) | `pasadena home remodel`, `pasadena craftsman renovation`, `91101 contractor`, `91106 contractor` |
| **Palmdale** | `palmdale remodeling contractor` | 220 | **Low (18)** | `palmdale remodel`, `palmdale home contractor`, `antelope valley remodel`, `93550 contractor`, `93551 contractor` |
| **Beverly Hills** | `beverly hills remodeling contractor` | 290 | High (45) | `beverly hills luxury remodel`, `beverly hills home renovation`, `90210 contractor` |
| **Upland** | `upland remodeling contractor` | 150 | **Low (16)** | `upland remodel`, `upland home contractor`, `91784 contractor` |
| **Fullerton** | `fullerton remodeling contractor` | 200 | Low–Med (22) | `fullerton remodel`, `fullerton home renovation`, `92831 contractor` |
| **Pomona** | `pomona remodeling contractor` | 170 | **Low (17)** | `pomona remodel`, `pomona general contractor`, `91766 contractor` |
| **Rancho Cucamonga** | `rancho cucamonga remodeling contractor` | 240 | Low–Med (24) | `rancho cucamonga remodel`, `rancho cucamonga home contractor`, `91730 contractor`, `91737 contractor` |

**Total Tier 2 estimated capture:** ~3,800/mo combined volume across 15 cities. Top-10 rankings → ~200–400 monthly organic visitors per city → ~3,000–6,000 total monthly visitors from Tier 2 alone by mo 9–12.

---

## 5. Tier 3 — City × trade cells (75 cells, 15–25 initial)

Pattern: `[trade] [city]` — the highest-intent, highest-converting layer.

### Volume pattern (per cell, SoCal regional norms)

| Trade × city combination | Avg vol/mo | KD (typical) | Top-10 conv rate |
|---|---|---|---|
| Kitchen remodel × big city (Burbank, Glendale, Pasadena) | 80–250 | Med (25–35) | 10–15% |
| Kitchen remodel × small city (Upland, Palmdale, Pomona) | 30–120 | **Low (10–22)** | 12–18% |
| Bathroom remodel × any city | 50–180 | Low–Med (15–30) | 8–14% |
| ADU contractor × any city | 60–220 | **Low (12–25)** | 12–20% |
| Home addition × any city | 20–90 | Low (10–20) | 8–14% |
| Garage conversion × any city | 30–120 | **Very Low (8–18)** | 10–18% |

### Initial Tier 3 launch set (cells with DB evidence per [`playbook.md`](./playbook.md#41-trade--city-matrix-75-cells))

**Priority 1 (ship in 30-day sprint):**
| URL | Primary keyword | Est. vol | KD |
|---|---|---|---|
| `/trades/kitchen-remodeling/encino` | `kitchen remodel encino` | 130 | 24 |
| `/trades/adu-construction/encino` | `adu builder encino` | 80 | 18 |
| `/trades/bathroom-remodeling/encino` | `bathroom remodel encino` | 90 | 22 |
| `/trades/kitchen-remodeling/sherman-oaks` | `kitchen remodel sherman oaks` | 170 | 28 |
| `/trades/adu-construction/sherman-oaks` | `adu builder sherman oaks` | 90 | 20 |
| `/trades/kitchen-remodeling/glendale` | `kitchen remodel glendale` | 200 | 30 |

**Priority 2 (ship in months 2–3):**
| URL | Primary keyword | Est. vol | KD |
|---|---|---|---|
| `/trades/bathroom-remodeling/glendale` | `bathroom remodel glendale` | 130 | 26 |
| `/trades/adu-construction/glendale` | `adu builder glendale` | 110 | 22 |
| `/trades/kitchen-remodeling/burbank` | `kitchen remodel burbank` | 180 | 28 |
| `/trades/kitchen-remodeling/tarzana` | `kitchen remodel tarzana` | 90 | 20 |
| `/trades/kitchen-remodeling/woodland-hills` | `kitchen remodel woodland hills` | 150 | 26 |
| `/trades/kitchen-remodeling/beverly-hills` | `kitchen remodel beverly hills` | 240 | 40 |
| `/trades/kitchen-remodeling/fullerton` | `kitchen remodel fullerton` | 100 | 22 |
| `/trades/bathroom-remodeling/fullerton` | `bathroom remodel fullerton` | 70 | 18 |
| `/trades/kitchen-remodeling/upland` | `kitchen remodel upland` | 80 | 14 |
| `/trades/bathroom-remodeling/upland` | `bathroom remodel upland` | 60 | 14 |
| `/trades/bathroom-remodeling/pomona` | `bathroom remodel pomona` | 90 | 18 |
| `/trades/kitchen-remodeling/rancho-cucamonga` | `kitchen remodel rancho cucamonga` | 120 | 22 |
| `/trades/bathroom-remodeling/rancho-cucamonga` | `bathroom remodel rancho cucamonga` | 90 | 20 |

**Deferred (build when DB has evidence — Path C):**
- All Studio City, Calabasas, Pasadena, Palmdale cells (0 projects currently)
- ADU/Addition/Garage cells for cities other than Encino/Sherman Oaks/Glendale until DB fills

### Tier 3 supporting keyword pattern (per cell)

For each `[trade] [city]` page, supporting cluster includes:
1. `[trade] [city]` (primary)
2. `[trade] in [city]`
3. `[trade] contractor [city]`
4. `best [trade] [city]`
5. `[trade] cost [city]`
6. `[trade] near me` (page surfaces in proximity searches from that city)
7. `[neighborhood] [trade]` (where neighborhood = sub-city name, e.g., "encino hills kitchen remodel")

---

## 6. Blog posts — TOFU + LLM citation engine

Per playbook §4.3, 3–4 posts/mo × 12 months = ~40 posts. Each post serves: (a) head-term keyword capture, (b) LLM citation seeding, (c) topical cluster authority for the relevant Tier 1 pillar, (d) sales enablement.

### 6.1 Cost guide cluster (highest commercial value)

| Post | Primary keyword | Est. vol | KD | Pillar |
|---|---|---|---|---|
| `kitchen-remodel-cost-los-angeles-2026` | `kitchen remodel cost los angeles` | 1,800 | Med (35) | Kitchen |
| `bathroom-remodel-cost-los-angeles-2026` | `bathroom remodel cost los angeles` | 1,200 | Med (32) | Bathroom |
| `adu-cost-los-angeles-2026` | `adu cost los angeles` | 1,400 | Med (30) | ADU |
| `home-addition-cost-los-angeles-2026` | `home addition cost los angeles` | 600 | Low (22) | Addition |
| `garage-conversion-cost-los-angeles-2026` | `garage conversion cost los angeles` | 500 | **Low (16)** | Garage |

### 6.2 Permit guide cluster (high local authority signal)

| Post | Primary keyword | Est. vol | KD |
|---|---|---|---|
| `adu-permit-los-angeles-2026-timeline` | `adu permit los angeles` | 800 | Med (28) |
| `kitchen-remodel-permit-los-angeles` | `kitchen remodel permit los angeles` | 400 | Low (20) |
| `bathroom-remodel-permit-los-angeles` | `bathroom remodel permit los angeles` | 300 | Low (18) |
| `home-addition-permit-los-angeles` | `home addition permit los angeles` | 280 | Low (18) |

### 6.3 Comparison guide cluster (decision-stage intent)

| Post | Primary keyword | Est. vol | KD |
|---|---|---|---|
| `adu-vs-home-addition-which-is-better` | `adu vs home addition` | 600 | Low (15) |
| `detached-vs-attached-adu-comparison` | `detached vs attached adu` | 500 | Low (14) |
| `kitchen-remodel-vs-renovation` | `kitchen remodel vs renovation` | 400 | Low (16) |
| `garage-conversion-vs-detached-adu` | `garage conversion vs adu` | 350 | **Low (12)** |
| `prefab-vs-custom-adu` | `prefab vs custom adu` | 280 | Low (14) |

### 6.4 FAQ / mistake / process clusters (LLM citation magnets)

| Post | Primary keyword | Est. vol | KD |
|---|---|---|---|
| `kitchen-remodel-mistakes-to-avoid` | `kitchen remodel mistakes` | 1,200 | Med (32) |
| `10-questions-to-ask-kitchen-remodeling-contractor` | `questions to ask kitchen remodeler` | 600 | Low (22) |
| `what-to-expect-during-kitchen-remodel-week-by-week` | `kitchen remodel process` | 800 | Med (28) |
| `adu-rental-income-los-angeles` | `adu rental income california` | 400 | Low (18) |
| `socal-kitchen-design-trends-2026` | `2026 kitchen trends` | 1,800 (seasonal) | Med (34) |

### 6.5 Regulatory / news cluster (newsworthy + link bait)

| Post | Primary keyword | Est. vol | KD |
|---|---|---|---|
| `ab-2221-adu-changes-2026-explained` | `ab 2221 adu` | 200 (high commercial value) | Low (15) |
| `sb-9-california-housing-law-explained` | `sb 9 california` | 600 | Med (32) |
| `ladwp-rebates-energy-efficient-remodel` | `ladwp rebates` | 350 | Low (18) |

### 6.6 Case-study deep-dive cluster (E-E-A-T + proof)

Pulls heavily from projects DB. Each post takes 1 real project and tells the STAR-format story (challenge → solution → result → before/during/after) at 2,000–3,000 words with full photo gallery. Low volume on direct search, HIGH internal-linking value, supports Tier 2 + Tier 3 pages.

Examples (using existing DB projects):
- "How We Transformed an Encino Mid-Century Kitchen for $147k"
- "Detached ADU in Sherman Oaks — From Permit to Cert of Occupancy in 8 Months"
- "Glendale Master Bath Remodel: Walk-In Shower + Heated Floors"

---

## 7. Branded keyword strategy

These should already convert at 50%+ since the user is searching for us by name. The goal is to ensure we OWN our branded SERP (top 3 results all controlled by us).

| Branded query | Owned surface |
|---|---|
| `tri pros remodeling` | Home page + GBP + LinkedIn + Yelp + BBB |
| `tri pros remodeling reseda` | GBP (legacy listing, once claimed) |
| `tri pros remodeling reviews` | GBP reviews carousel + dedicated `/portfolio/testimonials` page |
| `tri pros remodeling pricing` | Cost guide for primary trade + `/services` page |
| `tri pros remodeling [city]` | Tier 2 city hub for that city |
| `is tri pros remodeling legit` | About page + license number + reviews (defensive query) |

**Monitor branded volume trend:** Branded queries growing 10%+ MoM is a leading indicator of organic + word-of-mouth program health.

---

## 8. Negative keyword list (Google Ads + content avoidance)

Things we explicitly DON'T target:
- `cheap` modifiers (`cheap kitchen remodel`, `cheapest contractor`)
- `DIY` modifiers (low intent, wastes spend in paid)
- `home depot` / `lowes` / `ikea` modifiers (brand-specific intent, not us)
- `permit only` / `unlicensed` (legally risky audience)
- `commercial` / `office` (not our customer)
- `apartment` / `condo` modifiers (not our SFH-owner target)
- Roofing / windows / solar / HVAC head terms (per playbook §3.2)

---

## 9. Search seasonality (Google Trends — SoCal)

| Trade | Peak season | Trough season | Implication |
|---|---|---|---|
| Kitchen remodel | Jan–Mar (new-year planning + tax refund) | Jul–Aug | Publish cost guides Nov–Dec to catch January surge |
| Bathroom remodel | Steady year-round w/ slight Apr–Jun lift | Dec | Less seasonal — consistent capacity |
| ADU | Mar–Jun (spring building season) | Nov–Jan | Front-load ADU content Feb–Mar |
| Home addition | Mar–May (post-tax-return) | Oct–Dec | Tax-return-driven; promote financing options Feb–Apr |
| Garage conversion | Mar–Jul | Nov–Feb | Spring/early-summer push |

---

## 10. Refresh schedule

| Content type | Refresh cadence | Trigger |
|---|---|---|
| Cost guides | **Quarterly** | New pricing data, new project completions |
| Permit guides | **Annually + on law changes** | AB / SB updates, fee schedule changes |
| Tier 1 head pages | **Bi-annually** | New trade techniques, new project examples |
| Tier 2 city hubs | **Quarterly** | New projects in that city |
| Tier 3 cells | **Quarterly** | New project gallery additions |
| Blog (general) | **Top-10% performers refreshed every 6 months** | GSC clicks drop OR competitor newer content ranks above |

Refresh = update `lastModified` (which then propagates to sitemap), update the date in title/h1 ("2026" → "2027"), refresh stats/data, add new internal links to newly-published related content.

---

## 11. Open questions / refinements needed

These need Ahrefs data or real-world validation before locking:

- [ ] Validate KD estimates with Ahrefs once subscribed
- [ ] Pull "Content gap" reports vs. top 5 SoCal competitors per trade
- [ ] Run GSC Performance report monthly post-launch to surface real query patterns
- [ ] Validate seasonality patterns with Tri Pros' actual closed-deal data (cross-reference customer DB with month of project start)
- [ ] Confirm Palmdale market viability via local SERP analysis (light competition assumption)
- [ ] Identify long-tail "neighborhood + trade" terms (e.g., "encino hills kitchen remodel") via Ahrefs Keyword Explorer post-subscription
