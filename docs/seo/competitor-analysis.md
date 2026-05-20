# Competitor Analysis — Tri Pros Remodeling

> **Status:** v1 framework + initial findings (pre-Ahrefs deep research)
> **Owner:** Internal marketing operator + Claude
> **Updated:** 2026-05-19
> **Read [`playbook.md`](./playbook.md) first.**

## How to use this doc

This is both **a framework** (the methodology) and **a living artifact** (the findings, updated quarterly). The current content is initial pre-Ahrefs analysis based on industry knowledge of the SoCal home improvement SERP. Once Ahrefs is subscribed (Week 1 of sprint), the operator runs the methodology in §3 to populate real data and updates this doc.

---

## 1. Why we do competitor analysis

Three concrete outputs we use this analysis for:
1. **Keyword gap discovery** — terms competitors rank for that we don't (yet)
2. **Backlink prospecting** — sites linking to top competitors that we can also pitch
3. **Content gap audit** — topics they cover that we should also cover (and where we can be better)

Three things we do NOT do:
1. ❌ Copy their content (Google detects + penalizes)
2. ❌ Match their tactics 1:1 (some are doing things we won't, like buying links — would put us at risk)
3. ❌ Obsess over the leader (top 1–2 results are PE-backed; ranking #4 against PE-backed #1 is still a great outcome)

---

## 2. Competitive landscape — SoCal home improvement SERP

Three tiers of competitors. Each tier requires a different counter-strategy:

### Tier A — National PE-backed roll-ups
Large multi-state operators with $10M+ annual SEO budgets, polished branding, mass-scale content production.

**Examples:** Modernize, Networx, HomeAdvisor (Angi), Thumbtack, Porch, Sweeten
- These aren't really "remodelers" — they're lead-gen brokers selling leads to small contractors.
- They dominate generic head terms ("kitchen remodeling," "find a contractor").
- **Our counter:** never compete on generic head terms. Focus on `[trade] [city]` long-tail where they're optimized for breadth, not depth.

### Tier B — Multi-location regional operators
Real contractors with multiple SoCal locations, established websites, 5+ years SEO history.

**Likely SoCal examples to validate via Ahrefs:**
- HHC Builders / Home Hub Construction
- Jackson Design and Remodeling
- Premier Builders (LA area variants)
- Brian Kerns Builders / similar
- Hartman Baldwin / similar premium brands
- Mr Cabinet Care, KitchAid LA (kitchen specialists)
- Cardinal Construction (LA-area generalist)

**Our counter:** match their content depth but beat them on real-DB-backed evidence (our Tier 3 cells are uncopyable because they have real city-tagged project galleries).

### Tier C — Local single-shop operators
Direct competitors — 1 location, 1 owner, 0–5 employees, SEO maturity varies wildly. Some are sophisticated; most are not.

**Likely SoCal examples in our anchor cities (validate via Local Falcon scans):**
- Various Encino / Sherman Oaks / Tarzana family-owned remodelers
- Glendale Armenian-community contractors (often strong with native-language SEO)
- Burbank / Pasadena boutique design-build firms

**Our counter:** outpace them with consistency + content velocity. Most local shops post 0–1 blog posts/year. We're doing 3–4/month. The compounding gap closes them out by mo 9.

---

## 3. Research methodology (run quarterly)

### 3.1 Identify top 5 competitors per trade × city cell

For each priority cell (start with Tier 1 trades × top 5 anchor cities):

1. **Run private/incognito search** for the primary keyword (e.g., `kitchen remodel encino`)
2. **Record:**
   - Top 10 organic results (URL + title + meta)
   - Local pack 3 results (business name + review count + avg rating + GBP categories)
   - "People also ask" boxes
   - AI Overview source citations (if present)
   - Related searches at bottom
3. **In Ahrefs Site Explorer**, paste each competitor URL:
   - Domain Rating (DR) → authority benchmark
   - Total referring domains → link velocity benchmark
   - Organic keywords count → content surface benchmark
   - Top pages → what's actually driving their traffic
4. **In Ahrefs Content Gap**, compare us vs. competitors → terms they rank for + we don't

### 3.2 Backlink prospecting via competitor audit

For each top-5 competitor:

1. Ahrefs Site Explorer → Backlinks
2. Filter:
   - DR > 20 (avoid spammy)
   - Language: English
   - Type: dofollow
   - Status: live
3. Export
4. Manually triage each into: ✅ "feasible to outreach", ⚠️ "maybe", ❌ "skip"
5. Add the ✅ list to monthly outreach roster

### 3.3 Content gap analysis

For each priority Tier 1 + cost guide:

1. Ahrefs Content Gap report: our domain vs. top 5 competitors
2. Filter for KD < 30 + volume > 100
3. Categorize by intent (commercial vs. informational vs. comparison)
4. Add winning keywords to [`keyword-map.md`](./keyword-map.md) as new blog post or page candidates

### 3.4 Local pack competitive intel

For each anchor city × primary trade:

1. Local Falcon scan → see which competitors hold which grid points
2. For top-3 competitors in each city:
   - Review count + avg rating
   - Photos count + recency
   - GBP categories
   - Services list count
   - Q&A presence
   - Post cadence (visible from public profile)
3. Identify the WEAKEST competitor in each city — that's our first target to displace

---

## 4. Pre-Ahrefs initial intel (industry-knowledge based)

### 4.1 What we know without data (and what to validate)

**SoCal kitchen remodel SERP characteristics (head term):**
- Top 3 is heavy with lead-gen brokers (Modernize, Sweeten, Angi) — we don't compete here directly
- Position 4–10 mixes regional design-build firms with PE-backed shops
- **Position 11–20 is winnable** for a focused local with strong on-page + real DB-backed evidence — that's our 6-month landing zone for `/trades/kitchen-remodeling`

**SoCal ADU SERP characteristics:**
- Much more fragmented than kitchen — no one fully dominates
- Several SoCal ADU specialists (DesignShop ADU, Levi Design Build ADU, Anchored Tiny Homes) — these are our REAL Tier B competition
- AB-2221-related content thin → opportunity to own regulatory authority via blog
- **Top 10 is winnable in 3–6 months** with focused content + DB evidence

**Local pack characteristics (across all anchor cities):**
- 3-pack typically dominated by 2–3 long-standing local shops + 1 PE-backed remodeler
- Most competitors have 50–200 reviews; new entrants need to hit 30+ to start ranking
- Photos in GBP profiles are weak — most contractors have <20 photos, none geo-tagged
- Q&A nearly universally empty — moat opportunity

### 4.2 Initial competitor watch list (validate + expand via §3)

| Competitor | Tier | Strengths | Weaknesses to exploit |
|---|---|---|---|
| Modernize / Angi / HomeAdvisor | A | Massive domain authority, paid ad spend | Generic content; no local depth; broker model loses trust at decision stage |
| Jackson Design & Remodeling | B (San Diego–anchored, some LA) | Strong brand, deep portfolio | Smaller LA presence; we beat on local SFV/SGV/IE specificity |
| HHC Builders | B | Multi-location, good photos | Generic copy; thin per-city content |
| Mr Cabinet Care | B-kitchen | Kitchen-specialist authority | Single-trade focus; we beat with multi-trade bundling |
| Anchored Tiny Homes (ADU) | B-ADU | ADU specialist with good content | Lower-touch / prefab-leaning; we beat on custom SFV/SGV ADU positioning |
| Various local SFV remodelers (TBD) | C | Existing local relationships, reviews | Content velocity (we ship 10x more) |

**Action:** Operator runs §3 in Week 2 of sprint and replaces this table with real data.

---

## 5. Content gap (initial hypothesis)

Topics most competitors do NOT cover well — opportunities for us:

| Gap topic | Why it's a gap | Our angle |
|---|---|---|
| **City-specific permit timelines + fees** | Tedious research; most contractors don't bother | Operator can compile from each city's building dept site (one-time effort) → cost guide + Tier 2 differentiator |
| **AB 2221 / SB 9 ADU regulatory explainers** | Lawyers + activists cover this; contractors don't | We're the operator who actually built under these laws → first-person authority |
| **LADWP / SoCalGas rebate eligibility per remodel type** | Buried in utility websites | Cost guide gold; LLM citation magnet |
| **Real before/after photo deep-dives (>2,000w per project)** | Most show galleries with no narrative | We have the STAR-structured DB data; no competitor has this asset structure |
| **Detailed cost breakdowns ($X for cabinets, $Y for permits, $Z for labor)** | Contractors fear price transparency | We model honest ranges with caveats → trust signal |
| **Neighborhood-level content (e.g., "Encino Hills kitchen remodel")** | Most contractors stop at city level | We can sub-segment via blog/cost guides → long-tail capture |
| **Spanish-language content for SoCal remodel customers** | Top 3 competitors lack Spanish landing pages | Major opportunity for Spanish content in SFV / IE markets — defer to year 2 |

---

## 6. Backlink target categories (where we'll prospect)

Based on what's likely in top competitor backlink profiles (validate via Ahrefs §3.2):

### Trade publications + design blogs
- Houzz (featured pro)
- Dwell (case study submission)
- ArchDaily (project feature)
- Architectural Digest Pro Directory
- Remodeling Magazine (industry trade)
- Custom Home Magazine
- Builder Magazine

### Local LA-area media
- LA Times Real Estate section
- Voyage LA
- Curbed LA (archive, defunct but indexed)
- Patch SFV / Patch Pasadena / etc.
- Spectrum News 1 SoCal
- Hoodline
- LA Magazine
- Pasadena Now / The Acorn (local papers)

### Industry directories + associations
- NARI Greater LA (member directory)
- NAHB (national)
- BBB A+ profile
- CSLB contractor lookup (state-level; technically not a backlink but a verification anchor)
- Reseda / Encino / Sherman Oaks Chamber of Commerce
- Houzz Pro Directory
- Energy Star Partner (if applicable)

### Adjacent service partners (mutual referral links)
- Local interior designers
- Real estate agents (RE/MAX / Compass / Coldwell offices in anchor cities)
- Mortgage brokers (for financing referrals)
- Architects (joint project credits)
- Tile / cabinet / appliance suppliers (vendor partner pages)
- Pool / landscape companies (cross-referral, non-overlapping trades)

### Sponsorship + community
- Habitat for Humanity SFV
- Rebuilding Together LA
- Local school PTAs / sports teams (sponsorship pages)
- Local nonprofit events (.org links)

### Press / journalism (HARO / SOS responses)
- Real estate journalists
- Home improvement reporters
- ADU policy beat reporters
- Real Simple / Apartment Therapy / Bob Vila freelancers
- Bay-area / LA-area freelance journalists writing on California housing

---

## 7. Defensive monitoring

Things to watch monthly to catch competitor moves early:

| Signal | Source | Action if detected |
|---|---|---|
| Competitor publishes major cost guide | Ahrefs new pages alert (set up per competitor) | Audit ours; refresh if outdated |
| Competitor launches a new city hub in our anchor 15 | Manual SERP check + Ahrefs domain reports | Verify our city hub is stronger; if not, prioritize improvement |
| Competitor jumps to top of local pack we dominate | Local Falcon scan deltas | Audit their GBP changes; reverse-engineer what moved (reviews? posts? photos? citations?) |
| Competitor earns major press placement | Ahrefs new backlinks report | Pitch same publication ourselves with adjacent angle |
| New competitor enters our city | Quarterly Local Falcon scan | Track if they're real Tier B/C; if so, add to watch list |

---

## 8. Refresh schedule

This doc updated quarterly:
- **Q1 refresh:** populate §4 with Ahrefs-verified competitor list + DR + RD + traffic estimates
- **Q2 refresh:** rerun §3.1–3.4 against same competitors; track movement (us vs. them)
- **Q3 refresh:** add new competitors that emerged; remove inactive ones
- **Q4 refresh:** year-end strategic review — are we beating who we expected to beat?

---

## 9. Open questions / refinements needed

- [ ] Ahrefs subscription required to populate §4 with real data
- [ ] Operator to run §3 in Week 2 of sprint and complete §4 table
- [ ] Decide which 3 competitors get monthly tracking (vs. quarterly) once initial scan done
- [ ] Build a simple internal dashboard pulling Ahrefs API for top 5 competitors (year-2 project — manual quarterly works fine for year 1)
