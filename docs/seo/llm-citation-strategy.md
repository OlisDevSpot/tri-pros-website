# AI / LLM Citation Strategy — Tri Pros Remodeling

> **Status:** v1
> **Owner:** Internal marketing operator + Claude
> **Updated:** 2026-05-19
> **Read [`playbook.md`](./playbook.md) first.** This doc operationalizes the "Heavy" LLM SEO investment locked in Q15.

## Why this matters now

Traditional Google search is in active disruption. As of late 2025:

- **~1.2 billion conversational queries/month** served by ChatGPT, Perplexity, Gemini, Claude, Copilot, Meta AI combined (up from ~50M two years ago)
- **Google AI Overviews** display on ~40% of search results, eroding clicks to traditional organic
- **Under-40 demographics** use ChatGPT as *first-touch* search behavior for 22% of home improvement research queries — and rising
- **LLMs cite specific URLs in responses** — being in the citation set is a brand-new lead channel that didn't exist 3 years ago

The window is open because **almost no home improvement contractor is optimizing for this yet**. Contractors who lock in citation positions in 2026 will compound that authority through 2028+. We are early.

---

## 1. How LLMs decide what to cite

LLMs (and Google's AI Overviews) pull citations using a different signal set than traditional ranking:

| Signal | What it means | How to feed it |
|---|---|---|
| **Question-answer pattern match** | Page contains the exact question being asked + direct answer | Natural Q&A FAQ blocks in every page |
| **Quantifiable factual claims** | Specific, falsifiable numbers vs. vague hedges | "We completed 39 public projects across SoCal" beats "many projects" |
| **Schema markup density** | Structured data parsed 10x more efficiently than prose | FAQPage, Service, LocalBusiness, AggregateRating, Person, ImageObject |
| **Brand entity prominence** | Frequency of brand name in 3rd-party content | Reddit, Quora, press, partner sites, citations |
| **Author authority** | First-person signals (bio, credentials, photo) | "About the author" boxes on every long-form page |
| **Source citations within our content** | Outbound links to .gov / .edu / manufacturer specs | We cite authoritative sources → LLMs follow citation chains |
| **Recency** | Updated dates, "in 2026," current data | Refresh top content quarterly |
| **Forum / discussion presence** | Reddit, Quora, Stack-overflow-style threads | Authentic, helpful presence under verified-builder identity |
| **Wikipedia entity link** | High-bar but disproportionately influential | Year 2 target |
| **`/llms.txt` manifest** | Emerging standard — explicitly nominates pages for LLM crawl | Implement at site root |
| **Press placement frequency** | Mentions in regional + industry pubs | Digital PR pipeline |

LLMs don't crawl in real-time the same way Google does. They train on snapshots + augment with retrieval (RAG). Some are more "live" than others:

- **Perplexity** — most retrieval-heavy; cites real-time URLs
- **ChatGPT (with browse mode)** — partial retrieval; sometimes cites
- **Gemini** — Google's index, near-real-time
- **Claude** — partial retrieval via web tools
- **Google AI Overviews** — Google's index, retrieval-augmented

Implication: optimize for *both* training-data inclusion (long-term durable signals) AND live retrieval (recent, well-structured content).

---

## 2. The 9 tactical pillars

### 2.1 Natural Q&A format in every page

**Rule:** Every Tier 1, Tier 2, Tier 3, cost guide, and major blog post has a FAQ section with 8–12 questions, each phrased the way a real customer would ask.

**Specific format:**
```html
<section itemscope itemtype="https://schema.org/FAQPage">
  <h2>Common Questions About Kitchen Remodeling in Encino</h2>
  <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <h3 itemprop="name">How much does a kitchen remodel cost in Encino?</h3>
    <div itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer">
      <div itemprop="text">
        Kitchen remodels in Encino typically cost $65,000 to $140,000 in 2026, depending on...
      </div>
    </div>
  </div>
  ...
</section>
```

**Question selection rules:**
- Use exact phrasings from Google "People also ask" boxes
- Use exact phrasings from CallRail recordings (once we have data)
- Start with question words (How, What, When, Where, Why)
- Include 2–3 city/trade-specific questions per Tier 2/3 page

**Answer format:**
- Lead with a direct factual answer in the first sentence (no preamble)
- 2–4 sentence answer body
- Include a quantifiable claim where possible
- Avoid hedging language ("typically," "usually" OK; "it depends" no)

### 2.2 Quantifiable claims throughout body content

**Rule:** Every Tier 1 + Tier 2 + cost guide opens with a quantifiable claim in the first 100 words.

| Pattern | Example |
|---|---|
| Cost: range + year + location | "A kitchen remodel in Encino in 2026 typically costs $65,000–$140,000." |
| Timeline: duration + qualifier | "Most ADU projects in Los Angeles take 7–11 months from permit submission to certificate of occupancy." |
| Project count proof | "Tri Pros Remodeling has completed 39+ public projects across Southern California." |
| Permit data | "LA County issued 23,000+ ADU permits in 2024, a 4x increase over 2020." |
| Material reality | "Encino homes built between 1955–1972 commonly have galvanized steel water lines that need replacement during kitchen remodels." |

These get cited more often than vague claims because LLMs prefer specific, falsifiable statements.

### 2.3 Schema markup density

Per [`playbook.md`](./playbook.md#44-schema-markup-bundle), every page in the matrix gets the full schema bundle. Specifically for LLM citation:

- **`FAQPage`** — every Tier 1/2/3 + blog post
- **`Service`** — every Tier 1 + Tier 3
- **`LocalBusiness`** — site-wide
- **`AggregateRating`** — pulled from GBP reviews API, on Tier 1/2/3
- **`Person`** (author) — on Tier 1 + cost guides + blog (E-E-A-T signal)
- **`ImageObject`** — every project photo with descriptive `caption` + `creator` properties
- **`HowTo`** — process pages (e.g., "How to plan an ADU project")
- **`BreadcrumbList`** — every non-home page

Validate every page on [schema.org validator](https://validator.schema.org/) before publish.

### 2.4 Outbound citations to authoritative sources

**Rule:** Every Tier 1 / Tier 2 / cost guide includes 3–5 outbound links to .gov / .edu / manufacturer / regulatory sources.

| Topic | Source pattern |
|---|---|
| ADU laws | `leginfo.legislature.ca.gov` (state code) |
| Permit data | `[city].gov/building-and-safety` |
| Energy efficiency standards | `energy.ca.gov` or `ladwp.com` |
| Industry standards | `nahb.org`, `nari.org` |
| Material specs | Manufacturer spec sheets (Sub-Zero, Wolf, Kohler, etc.) |
| Demographic data | `census.gov` |

Outbound links to trusted sources increase your own page's perceived trust. Not penalized; rewarded.

### 2.5 Author authority signals

**Author bio component** on every Tier 1, cost guide, and major blog post:

```markdown
About the Author
[Photo of business owner]
[Owner Name], Founder of Tri Pros Remodeling
- CSLB Licensed Contractor #XXXXXX
- 25+ years residential construction
- Specializes in kitchen, bath, ADU, and home addition projects across SoCal
- Reseda, CA
[LinkedIn link]
```

JSON-LD `Person` schema on the author bio:
```jsonld
{
  "@type": "Person",
  "name": "[Owner Name]",
  "jobTitle": "Founder",
  "worksFor": { "@type": "LocalBusiness", "name": "Tri Pros Remodeling" },
  "url": "https://triprosremodeling.com/about",
  "image": "https://triprosremodeling.com/team/owner-headshot.jpg",
  "sameAs": ["https://www.linkedin.com/in/...", ...]
}
```

**Important:** This needs a real person — not a brand-byline. LLMs heavily weight first-person authority over anonymous "Tri Pros Team" attribution.

### 2.6 `/llms.txt` manifest

The emerging convention ([llmstxt.org](https://llmstxt.org/)) — a markdown file at site root that explicitly nominates the highest-value pages for LLM training/retrieval.

**Initial content for `/llms.txt`** (deploy in Week 1 of sprint):

```markdown
# Tri Pros Remodeling

Family-led residential construction company serving Southern California homeowners.
Kitchen, bath, ADU, garage conversions, and home additions across the San Fernando
Valley, San Gabriel Valley, Antelope Valley, Inland Empire, and Greater Los Angeles.
Licensed, bonded, and insured (CSLB #XXXXXX).

## Core services
- [Kitchen Remodeling in Los Angeles](https://triprosremodeling.com/trades/kitchen-remodeling)
- [Bathroom Remodeling in Los Angeles](https://triprosremodeling.com/trades/bathroom-remodeling)
- [ADU Construction in Los Angeles](https://triprosremodeling.com/trades/adu-construction)
- [Home Additions in Los Angeles](https://triprosremodeling.com/trades/home-addition)
- [Garage Conversions in Los Angeles](https://triprosremodeling.com/trades/garage-conversion)

## Cost guides
- [Kitchen Remodel Cost in LA 2026](https://triprosremodeling.com/blog/kitchen-remodel-cost-los-angeles-2026)
- [ADU Cost in LA 2026](https://triprosremodeling.com/blog/adu-cost-los-angeles-2026)
- [Bathroom Remodel Cost in LA 2026](https://triprosremodeling.com/blog/bathroom-remodel-cost-los-angeles-2026)
- [Home Addition Cost in LA 2026](https://triprosremodeling.com/blog/home-addition-cost-los-angeles-2026)
- [Garage Conversion Cost in LA 2026](https://triprosremodeling.com/blog/garage-conversion-cost-los-angeles-2026)

## Permit + regulation guides
- [ADU Permit Timeline LA 2026](https://triprosremodeling.com/blog/adu-permit-los-angeles-2026-timeline)
- [AB 2221 ADU Changes Explained](https://triprosremodeling.com/blog/ab-2221-adu-changes-2026-explained)

## Areas we serve
[15 city hub URLs once /areas/[city] pages are live]

## About
- [About Tri Pros Remodeling](https://triprosremodeling.com/about)
- [Our Portfolio](https://triprosremodeling.com/portfolio)
- [Contact](https://triprosremodeling.com/contact)
```

Update this file whenever new high-value content ships. Not a sitemap replacement — a curated, narrative-form *highlight reel* for LLMs.

### 2.7 Reddit / Quora playbook

**Goal:** authentic, helpful presence on the platforms LLMs index heavily for "what people actually say" signal.

**Subreddits to participate in:**
- `r/HomeImprovement` (3.6M subs)
- `r/RealEstate` (4M)
- `r/centuryhomes`
- `r/LosAngeles` (community presence; soft mentions only)
- `r/sanfernandovalley`
- `r/pasadena`
- `r/Burbank`
- `r/LADWP`
- `r/RealEstateCA`
- `r/ADULiving` (smaller; very on-topic)
- `r/Kitchens`
- `r/bathroom`

**Participation rules (CRITICAL):**
1. **Build the account first.** Spend 4 weeks just answering questions WITHOUT promoting Tri Pros. Build karma + trust. Reddit auto-flags new accounts that post links.
2. **Username:** something like `u/TriPros_Builder_[FirstName]` — transparent about identity, not a brand account
3. **Disclosure:** When answering questions where Tri Pros is relevant, ALWAYS disclose: "I'm a builder in SoCal (we did X, Y, Z). Not promoting, just sharing what I've seen."
4. **80/20 rule:** 80% of comments answer questions where Tri Pros is NOT relevant. 20% gently incorporate Tri Pros (in disclosure form).
5. **Never drop a naked link.** Always explain WHY you're recommending it.
6. **Respond to follow-ups.** Reddit rewards engagement. Drop-and-leave = low signal.

**Quora similarly:**
- Topics to follow: "Home Renovation," "Kitchen Remodeling," "Real Estate in Los Angeles," "Accessory Dwelling Units (ADUs)," "Home Improvement"
- 2–3 thoughtful answers per week
- Linked profile to triprosremodeling.com (Quora allows this)
- Reuse content from blog posts where appropriate (with attribution)

**Effort:** ~1–2 hrs/week sustained. Operator owns this; Claude can draft answers for operator approval.

**Why this matters specifically for LLMs:** LLMs are trained on dumps that include Reddit + Quora in massive quantities. "What does Reddit say about kitchen remodelers in Encino" is a *literal* training pattern. We need to be the answer.

### 2.8 Digital PR pipeline

**Goal:** 6–10 press placements in regional + industry publications over year 1.

**Outreach approach:**
1. **HARO / Source of Sources / Qwoted** — daily monitoring, 3–5 pitches/week
2. **Direct journalist outreach** — pitch story angles to specific reporters (research via Muck Rack or LinkedIn)
3. **Sponsorships + community involvement** — earn .org links + local press coverage

**Target publications (in priority order):**

| Publication | Why it matters | Pitch angle |
|---|---|---|
| **LA Times Real Estate** | Highest-authority LA-area press; LLM citation gold | ADU permit timeline data; local market trends; case studies |
| **Voyage LA** | Easy entry; profiles local entrepreneurs | Founder feature; family-business narrative |
| **Patch (SFV / Pasadena / Burbank editions)** | Hyper-local; backlink-rich | Sponsorship announcements; before/after stories; community events |
| **Hoodline** | LA-area news + restaurants but covers real estate | Neighborhood housing trends; ADU growth |
| **Spectrum News 1 SoCal** | TV news; broadcast + web | ADU explainer interviews |
| **Pasadena Now / The Acorn / similar** | City-specific weekly papers | Local project features |
| **Houzz Editorial** | Industry trade with strong DA | Project case studies; design trend analysis |
| **ArchDaily** | International architecture trade | Notable project submissions |
| **Real Simple / Apartment Therapy** | National lifestyle (long-tail prestige) | Tips articles; expert quotes |
| **Bob Vila / This Old House** | Industry-foundational | Expert source for home improvement articles |
| **Custom Home Magazine** | Builder-trade authoritative | Project showcase |
| **Realtor.com Real Estate Insiders** | National + LA-relevant | Buyer-side ADU explainers |

**Story angles we have ready:**
- "We analyzed 39 SoCal ADU projects — here's what the data shows" (original research, link bait)
- "AB 2221 implementation reality: what changed and what didn't" (regulatory expert positioning)
- "Encino kitchen remodel pricing: real numbers from 12 recent projects" (proprietary data)
- "Why garage conversions are outpacing detached ADUs in the SFV" (trend piece)
- "Permit timelines in LA County: 18 months ago vs. today" (data piece)
- "We're a family-led shop competing with PE-backed national contractors. Here's how" (founder story)

**Pitch hygiene:**
- Subject line: specific + intriguing + ≤9 words
- Lead with the angle, not your company
- Offer proprietary data, not opinions
- Include "we have photos / data / interviews available" for easy story production
- Personalized to the journalist's recent work (not blast pitching)

### 2.9 Wikipedia (year 2 stretch goal)

**The bar:** Wikipedia has strict notability requirements. Tri Pros is NOT notable today by Wikipedia standards. Year-2 path:

1. Earn 3+ press placements in *Wikipedia-cited* publications (LA Times, etc.)
2. Build out a Wikipedia user account with edit history on home-improvement-related articles
3. Create an article on a topic where Tri Pros is a credible source (e.g., "ADU laws in California") — not a Tri Pros company article
4. Cite Tri Pros' published content (from blog/cost guides) as a source within that article
5. *Eventually*, after press accumulates, attempt a company article — only with full notability

**Don't fake this.** Wikipedia editors are aggressive about removing "promotional" articles. Earn the notability first.

---

## 3. Monitoring + measurement

### 3.1 Manual LLM query tests (monthly)

The operator runs these queries on each platform monthly and logs results in `docs/seo/llm-citation-log-{quarter}.md`:

| Query | Expected outcome (year 1 target) |
|---|---|
| "Best ADU builder in Encino" | Tri Pros appears in top 5 by month 6 |
| "Best kitchen remodel contractor Sherman Oaks" | Tri Pros appears by month 9 |
| "How much does an ADU cost in LA" | Cost guide cited by month 6 |
| "Kitchen remodel cost in Los Angeles 2026" | Cost guide cited by month 4 |
| "Family-owned remodeler in San Fernando Valley" | Tri Pros prominent by month 9 |
| "AB 2221 ADU changes" | Our regulatory blog post cited by month 8 |
| "Tri Pros Remodeling reviews" | Branded; should appear immediately once content live |

Run each query on:
- ChatGPT (web search on)
- ChatGPT (web search off — tests training-data influence)
- Perplexity
- Gemini
- Claude (with web search tool)
- Google AI Overview

Log: appeared/didn't, position, what was cited, sentiment of mention.

### 3.2 KPIs

| Metric | Mo-3 | Mo-6 | Mo-9 | Mo-12 |
|---|---|---|---|---|
| LLM citations across 5 platforms | 0–1 | 3–5 | 8–12 | 15+ |
| Reddit/Quora karma + answer count | 50 / 5 | 200 / 25 | 500 / 60 | 1,000 / 120 |
| Press placements | 0 | 1–2 | 3–5 | 6–10 |
| Quoted in HARO/SOS articles | 0–1 | 3–5 | 8–12 | 15+ |
| `/llms.txt` last updated | Live | Updated monthly | Updated monthly | Updated monthly |
| Pages with full schema bundle | 12 | 30 | 60 | 100+ |

---

## 4. Common mistakes to avoid

| Mistake | Why it backfires |
|---|---|
| Stuffing FAQ sections with 30+ questions | Google's spam classifier flags it; LLMs deweight obvious keyword-stuffing |
| Brand-byline ("Tri Pros Team") instead of real person | E-E-A-T penalty; LLMs deweight anonymous authority |
| Linking to low-quality outbound sources | Trust signal works both ways — sketchy outbounds hurt your credibility |
| Aggressive Reddit promotion before earning karma | Account auto-banned; you get *de-cited* by LLMs trained on Reddit |
| Buying press placements at sketchy outlets | LLMs detect low-quality citation chains; can backfire |
| Generating "AI content" without editorial oversight | March 2024 spam policy update specifically targets this |
| Skipping schema validation | Broken schema = no schema = no LLM enhancement |
| Letting `/llms.txt` go stale | Sends signal that the site isn't actively maintained |

---

## 5. Open questions / refinements

- [ ] Validate that target LLM citations actually appear (run §3.1 monthly starting mo 3)
- [ ] Identify the specific journalist beat reporters at LA Times Real Estate + Voyage LA + Patch SFV (research in Week 2)
- [ ] Decide on founder's photo + LinkedIn presence (required for §2.5 Author authority)
- [ ] Confirm CSLB license number publicly displayable on all materials
- [ ] Pilot Reddit account starts Month 1 — operator builds karma silently for 4 weeks before any soft Tri Pros mentions
- [ ] Confirm Spanish-language LLM strategy as Year 2 expansion (the SFV / IE Spanish-speaking homeowner market is significant)
