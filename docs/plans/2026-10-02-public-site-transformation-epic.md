# Public site transformation epic

**Status:** E1 exploration, round 2 rejected 2026-10-02 (craft + cinema); round 2b (motion references, higher bar) in progress. D2 (evolve the identity) reopened pending 2b picks.
**Owner rulings so far:** 2026-10-02, see Decisions.

The public site reads as vibe-coded: generic luxury-builder copy, stock photos, commercial work we don't sell, one template repeated for every section, no before → after anywhere. This epic rebuilds it around one idea: we help homeowners turn the place they spend most of their life into a place worth living in.

## Decisions

| # | Ruling | Date |
|---|---|---|
| D1 | Audience: the **validator** (checking us out after a call or ad, before the in-home meeting) first, the cold prospect second. | 2026-10-02 |
| D2 | Identity: **evolve** Blueprint Authority. Keep Blueprint Blue and the fonts; allow cinematic, photo-led, editorial treatment. Amend DESIGN.md, don't replace it. | 2026-10-02 |
| D3 | AI media may stand in wherever real media is missing. Every AI asset goes on the replacement ledger below. | 2026-10-02 |
| D4 | One primary action site-wide: **Book a home visit**. The Showcase offer is a story beat, not the CTA. | 2026-10-02 |
| D5 | Scope: the **whole public site**, delivered as sub-projects E0–E5. | 2026-10-02 |
| D6 | Homepage arc: **chapters of a better life**, not one home's story. One project is too specific to resonate at scale. | 2026-10-02 |
| D7 | Chapters are cut **by the situation the homeowner lives with**: a pain they recognise → a real before/after → the life after → the trades that did it. Energy efficiency gets its own comfort and savings chapter. | 2026-10-02 |

## Requirements

**Story**
- R1. The homepage is a series of situation chapters, each pain → before/after → life after → trades.
- R2. Every chapter passes two tests: *"I wish that were me"* and *"these guys can fix my situation"*. The chapter list and copy are tested in rounds, not fixed on paper.
- R3. Energy efficiency has its own chapter, told through comfort and savings with visual proxies (thermal before/after, bills, a cool quiet room in July). Never solar.
- R4. Residential only. No commercial work, no "custom luxury homes".

**Voice and facts**
- R5. Every fact comes from `src/shared/constants/company/`. No invented testimonials, stats or prices. Showcase discount never quantified.
- R6. Voice from `docs/sales/` and `docs/marketing/showcase-offer.md`: trust, reframing, "done once, done right". SWCE as proof, never price.

**Audience and conversion**
- R7. The site answers the validator's three questions: are they real, who is coming to my house, what happens after I call.
- R8. "Book a home visit" is reachable from anywhere; sticky on phone.
- R9. Mobile-first: phone is the primary scene, desktop second.

**Media**
- R10. Real media leads. AI stands in only where real is missing, and is ledgered.
- R11. Project media comes from the project media library (`media_files`, R2, before/during/after phases), not static stock files.
- R12. The shoot list below is produced and fed into the ledger as real replacements land.

**Visual**
- R13. Evolved Blueprint Authority (D2), written into DESIGN.md.
- R14. No template sameness: sections don't all share a centered H2, a card grid and a fade-up.

**Quality**
- R15. LCP < 2.5s on a mid-range phone on 4G; video lazy behind a poster; `prefers-reduced-motion` respected.
- R16. WCAG AA; local SEO for the service-area cities kept or improved.

**Process**
- R17. Owner-in-the-loop rounds: reference mood board (Playwright) → structure warm-up (`/ui-warmup`) → section rounds (hero, chapters, proof, booking). The owner picks every round; picks are logged below.
- R18. Delivered as E0–E5; E1 first, pulling in only the E0 pieces it needs.

## Sub-projects

| # | Sub-project | Status |
|---|---|---|
| E0 | Foundations: DESIGN.md amendment, media pipeline (real project media → web-ready R2 variants), replacement ledger, shoot list, copy sources cleaned of solar | Started (core business docs cleaned 2026-10-02) |
| E1 | Homepage: situation chapters → Book a home visit | Exploring |
| E2 | Project story page: one real home's before / during / after (the homepage hands off here) | — |
| E3 | Booking / contact flow | — |
| E4 | About / team: "who is coming to my house" | — |
| E5 | Services / trades and portfolio index | — |

Each sub-project gets its own spec → plan → build.

## Exploration rounds (E1)

| Round | Question | Artifact | Pick |
|---|---|---|---|
| 1 | What do the best remodelers and storytelling sites do? | [Homepage Reference Board](https://claude.ai/artifact/4o5BBzjFdAZ9NidcJTCQey) (private): 14 ideas (I1–I14) from 12 sites + 4 to leave behind (A1–A4) | **Keep:** I2 face + one plain promise · I3 one quiet finished room, full bleed · I7 before/after drag slider · I11 savings card over the photo · A1 only the license # corner and the hero social links. **Maybe:** I4 dark, photo-led. Rest unmarked (undecided, not rejected). |
| 2 | Page structure: hero, chapter shape, proof, booking | [Homepage Warm-up](https://claude.ai/artifact/1BwAoNaWwg4mtrLLdmLuN7) (private): A one long story · B find your situation (recommended) · C proof first, after dark | **All rejected** ("horrendous, not even close"). Why: looks cheap/templated, no wow/no cinema. Story (situation chapters) and photos were not the objection. |
| 2b | What does world-class, cinematic storytelling look and move like? | [Homepage Motion Board](https://claude.ai/artifact/LCM7TdVm3A7oWSTNVn7VU6) (private): T1–T9 scroll recordings (Loam House, Velaa, ERA, Azimute, Cover, Apple, Storey, Olson Kundig, Rivian) + palette world pick | Awaiting owner |
| 3 | One high-fidelity, motion-rich prototype of the homepage story | Prototype page | — |

## Today's baseline (2026-10-02)

Six sections, all static: hero ("Crafting Architectural Masterpieces"), value props (emoji icons, hidden behind a 200vh sticky; a screen of blank space on load), services (includes Commercial Construction), a marquee of seven stock-like photos, testimonials (stat band says "5 Years Experience" against the hero's "45+ years combined"), consultation form. No real project media, no before → after.

## Media on hand

- **Real, web-ready:** `public/meeting-flow/trades/*.webp`: 10 curated real project shots.
- **Real, local only (gitignored, ~870MB originals):** `public/portfolio-photos/projects/` for Altura (6 before / 25 during / 5 after + video), Olympia (14 during / 7 after + video), Monique (16 after + video), Riviera, Atlas, Bliss.
- **Real before/after (funnels):** `public/funnels/{kitchens,bathrooms}/{before,after}-{1,2}.webp`.
- **People:** individual headshots in `public/company/employees/`. No group photo.
- **AI:** Remotion reels and Higgsfield clips and stills under `video/` (local), funnel ad stills, `public/process/*-stage.jpeg`.
- **Plumbing exists:** `media_files.phase` (before/during/after) + `isHeroImage`, public `showroom-display` router; whether prod rows are phase-tagged is unchecked.

## Shoot list

- [ ] Full team group photo
- [ ] Crew on site, mid-build (branded)
- [ ] Homeowners in their finished spaces (with consent)
- [ ] Short real project films cut from the Altura / Olympia / Monique raw footage
- [ ] Energy comfort proof: thermal camera before/after, a real bill comparison (with consent)
- [ ] License, insurance, BBB, certification badge art

## AI replacement ledger

Every AI asset that ships on a public page gets a row. Remove the row when the real replacement ships.

| File | Used on | Stands in for | Real replacement |
|---|---|---|---|
| — | — | — | — |

## Open items

- **Media truth check (2026-10-02):** most `projects/*/hero-before|after` pairs are not true before/afters (Monique "before" is finished; Olympia pairs indoor with outdoor kitchen; Atlas "before" is a finished patio). True same-place pairs today: Altura yard, funnel kitchen pair 2; Riviera is during → after. Funnel kitchen pair 1 and bath pair 1 "after" images look rendered: owner to confirm. Monique photos (incl. `meeting-flow/trades/*-monique.webp`) carry a "Concierge" watermark: confirm rights before public use.
- Public `(site)` pages don't apply `.theme-marketing`; only funnels and /test do (DESIGN.md says marketing = Blueprint Authority).

- Solar still appears in ~30 docs. Clean the ones that feed public copy before E1 copy work: `docs/seo/keyword-map.md`, `docs/seo/playbook.md`, `docs/sales/story-bank.md`, `docs/sales/lead-magnets.md`, `docs/sales/customer-intelligence.md`.
- Check prod `media_files` for phase-tagged rows per project before designing around them.
