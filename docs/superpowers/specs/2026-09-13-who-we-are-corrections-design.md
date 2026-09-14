# Who We Are — Corrections Round 1

**Date:** 2026-09-13
**Status:** Decisions locked (grilling session 2026-09-13); built 2026-09-13, uncommitted
**Supersedes:** the content table in `2026-09-12-who-we-are-scroll-presentation-design.md` §3 where they differ.

Every figure below was confirmed by the user in the grilling session. Company facts
live in `src/shared/constants/company/`; meeting-only claims live in
`src/features/meeting-flow/constants/`.

---

## 1. Beats (new order)

| # | Kind | Title | Content | Media |
|---|---|---|---|---|
| 1 | hook | unchanged | unchanged | unchanged |
| 2 | point 1 | Proper licensing and permits | Proof in two groups. **Licensed & insured:** CA license #1076760 · $2M insurance per project · Bonded. **Reputation:** Family-owned · Google 4.9 (212 reviews) · Yelp 4.9 (49 reviews) · BBB A+. | License + COI document cards (unchanged images) |
| 3 | point 2 | A clear scope of work | Proof unchanged (`100%` · written & detailed). The pages are a **showcase of how we write scopes**, not a claim source: no proof figure derives from them. | Fanned sample scope-of-work pages; tap opens a dialog that scrolls every page |
| 4 | point 3 | Proper supervision | unchanged | unchanged |
| 5 | point 4 | Communication | About the **meeting owner (agent)**: headshot, name, contact card (phone, email, years of experience; each hidden when unset). Promise: the agent is the homeowner's point of contact from today to the final walkthrough. Commitments: calls and texts answered the same business day · a weekly progress update with photos · a pre-construction walk before work starts. | The agent's business card on the desk: headshot (`headshotUrl`, falling back to the account photo), name, role, contact lines |
| 6 | point 5 | Team & support staff | Sean Phil, **Senior Partner**: reviews every scope before it reaches you · reachable directly if something isn't right · construction-focused, professional contractor eyes on your job. Proof: `12+` support staff. | Sean portrait + team photo placeholder slot |
| 7 | point 6 | Proof of performance | unchanged | unchanged |
| 8 | comparison | The six you now know to ask | 6-row table, Tri Pros vs Other contractors, one row per point | none (dark ground) |
| 9 | comparison + truth | …and what most homeowners never think to ask | 8-row table, then the truth title + quote + CTA at reduced size | none (dark ground) |

Beats 8 and 9 lay out in flow with a one-screen minimum height: on a cramped stage (≤1024 with the sidebar open, tablet portrait) they grow and scroll instead of clipping.

No section numeral renders on the right-hand stage; the pinned column owns it.

Future (3–6 months, not built): communication becomes agent + project manager.

### 1.1 Comparison rows

Beat 8 (the six):

| Row | Tri Pros | Other contractors |
|---|---|---|
| Licensing & insurance | CA #1076760 · $2M per project · bonded | Unlicensed or underinsured; you carry the risk |
| Scope of work | Detailed and in writing before work starts | A one-line estimate or a handshake |
| Supervision | 2+ sets of eyes on every job | The crew, unsupervised |
| Communication | One direct contact · same-day replies · weekly updates | Chasing calls for days |
| Team & support | A senior partner + 12+ support staff | One person and a truck |
| Proof of performance | 520+ projects · Google 4.9 · BBB A+ | "Trust me" |

Beat 9 (the extras):

| Row | Tri Pros | Other contractors |
|---|---|---|
| Product warranties | Lifetime warranties on many of our products | Whatever the box says, if it's still valid |
| Experience | 45+ years of combined experience | Learning on your house |
| Operations | Office, field crew, and you on one live system | Lost paperwork and "let me check with the guys" |
| Progress | Every phase photographed and on record | You drive by to check |
| Financing | Financing and payment programs | Cash or check up front |
| Change orders | Any change is priced and signed before it happens | A surprise bill at the end |
| Payments | You pay as work is completed | A big deposit, then silence |
| Rebates | We find and file your energy rebates and tax credits | You're on your own |

## 2. Company-wide corrections

| Fact | Was | Now | Consumers updated |
|---|---|---|---|
| Support staff | `teamInfo.numEmployees: 25` ("Team Members", "25-person team") | `teamInfo.numSupportStaff: 12`, always labelled support staff | about/team.tsx, experience/studio-story.tsx, meeting-flow due-diligence |
| Combined experience | `combinedYearsExperience: 40` | `45` | constant; DESIGN.md, anti-slop-checklist.md, PRODUCT.md |
| Sean's title | Founder | Senior Partner | team-info.ts, team-members.ts, about/company-story.tsx, about/partner-story.tsx (renamed from founder-story.tsx), experience/studio-story.tsx, about page metadata |
| General liability | $1M GL + $10M commercial GL entries | one entry, `$2M per project` | insurances.ts (comparison-table, credentials, swce read it) |
| Bond | `Bonded · Up to $5M` + "Bonding Capacity" stat | Bonded, no amount; stat removed | insurances.ts / licenses, stats.ts |
| Ratings | Google `4.9 / 200` as component defaults, Yelp "Verified" | `reviews` constant: Google 4.9 (212), Yelp 4.87 (49, shown 4.9), BBB A+ | funnels/hero-trust-badges.tsx, meeting flow |
| Ownership | none | Family-owned constant | meeting flow |

## 3. Data access

UI reads the meeting owner through `meetingsRouter.reads.getByIdWithJoins`. The
projection gains `ownerEmail`, `ownerPhone`, `ownerHeadshotUrl`,
`ownerYearsOfExperience` (all existing `user` columns). No schema change, no
`db:push`.

## 4. Sample scope of work — next steps for the user

The build ships a local placeholder page image reused for every page, so the fanned
stack and dialog work end to end. To replace it:

1. **Pick the source.** A real signed agreement with the homeowner's name, address,
   phone, email and signature redacted, or a demo proposal rendered through the
   proposal PDF route. Decide whether prices stay visible (recommended: blur them;
   the showcase is the level of detail, not the price).
2. **Export pages to JPG** at 1700px wide:
   `pdftoppm -jpeg -jpegopt quality=85 -scale-to-x 1700 -scale-to-y -1 sample.pdf page`
   (produces `page-1.jpg` … `page-6.jpg`).
3. **Upload** to the `tpr-company-docs` bucket under `sample-scope-of-work/`
   (dashboard, or `wrangler r2 object put tpr-company-docs/sample-scope-of-work/page-1.jpg --file page-1.jpg --remote`).
   Check one URL loads: `https://pub-e9f58acecb564416a1d1880ba1a88a7f.r2.dev/sample-scope-of-work/page-1.jpg`.
4. **Tell Claude the page count.** The constant swaps the placeholder list for the
   R2 URLs and the placeholder image is deleted.

## 5. Follow-ups (not in this round)

- `docs/company/warranties-and-trust.md` and `competitive-advantage.md` still carry `[fill in]` placeholders (license, GL, bond, workmanship term, manufacturer certifications).
- `docs/sales/post-signing-sequence.md` hands off to a project manager on Day 1; today the agent owns the relationship end to end.
- `docs/seo/llm-citation-strategy.md:138` claims "25+ years residential construction".
- `team-members.ts` headshots point at `/company-info/*.jpeg` (no such folder) with mismatched stock names; only Sean's photo is real.
- Team photo shoot for beat 6.
