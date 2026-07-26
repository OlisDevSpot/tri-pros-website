# Showcase Campaign Launch — Design

**Date:** 2026-07-26 · **Status:** approved-pending-review · **Owner:** Oliver

Rebuild the Meta account structure from scratch around the principle **campaign =
offer, ad set = product**, ship the missing new-lead notification, and launch the
Kitchen + Bathroom Showcase today. Supersedes the two-campaign structure applied
2026-07-07 (`kitchens-leads` / `bathrooms-leads` specs).

Research grounding: three parallel research passes (structure, creative, and
measurement — 2025/2026 Meta + practitioner sources) validated the
campaign-as-offer taxonomy. Key verdicts baked into this design:

- Learning phase lives at the **ad-set** level — one campaign vs two changes
  management/reporting, not learning speed. Product ad sets are a sanctioned
  split (different LPs, per-product budget control); never add interest/demo
  ad sets.
- **ABO over CBO** at launch: identical audiences + unequal product economics
  means CBO would chase cheapest leads and over-fund bathrooms.
- **5 distinct creative concepts** per ad set (not 5 variations — Andromeda
  collapses near-duplicates); copy variation happens *inside* each ad via
  multiple text options (up to 5 primary texts / 5 headlines).
- Neither ad set will ever exit learning at $58/day (needs ~$285/day at $40
  CPL). Permanent "Learning Limited" is normal for local lead gen — judge on
  2–4-week CPL/cost-per-Schedule windows, avoid learning resets (budget moves
  ≤20%, no ad-set duplication).
- Attribution **7-day click only**; Advantage+ audience ON with min-age 35 as
  the only hard demographic control; 24/7 delivery, no dayparting.
- Risk watch: Meta's Housing special-ad-category nominally covers home-repair
  services. Enforcement on remodelers is inconsistent; if ever flagged, the
  fallback is 15-mile-radius geo + 18–65+ (ZIP lists and age floors get locked).
- Compliance for "we're selecting 5 …": scarcity must stay real (funnel has a
  genuine qualification mechanic — it does), phrased first-person about the
  program, never about viewer attributes; refresh cohort framing periodically;
  AI-modified creatives need Meta's AI-disclosure toggle.

## 1. Meta structure

New spec `scripts/meta/campaign-specs/showcase.campaign.ts` (replaces both
existing specs; registry updated):

```
Campaign: "TPR — Showcase — Leads"     Leads objective · ABO (no campaign budget)
├── Ad set: Kitchens  — $58/day  → kitchens funnel LP
└── Ad set: Bathrooms — $58/day  → bathrooms funnel LP
```

Ad-set settings (both): geo `SERVICE_AREA_ZIPS` (unchanged, incl.
`META_UNSUPPORTED_ZIPS` exclusions), age 35–65+ (`age_max: 65` = "65 and up" —
already uncapped), no gender restriction, Advantage+ audience ON, optimization
`LEAD` (pixel+CAPI dedup pair, renter-gated — unchanged), attribution 7-day
click only, highest-volume bidding, 24/7. Total $116/day — under the $166/day
engine ceiling.

Engine capability check during implementation — add support where missing
(additive): `targeting_automation.advantage_audience`, `attribution_spec`,
multiple text options per ad (`asset_feed_spec` text variants).

All engine hard guardrails unchanged: creates PAUSED, no status writes, no
deletes, budget ceiling, lock-file bookkeeping. Old `kitchens-leads` /
`bathrooms-leads` campaigns become orphans; Oliver deletes them manually (§3).

## 2. Creatives — 10 ads

Per ad set, 5 slots / 4 formats, message-matched to
`docs/marketing/showcase-offer.md` vocabulary, UTMs via `url_tags` per
convention, CTA `APPLY_NOW` (softest 1–2 ads may use `LEARN_MORE`):

| Slot | Format | Concept |
|---|---|---|
| 1 | 9:16 reel | Casting-call announcement (scarcity hook in first 2s) |
| 2 | 9:16 reel | Transformation/walkthrough (different hook + edit style) |
| 3 | Static (4:5 + 9:16) | Before/after split (top/bottom stack for 9:16) |
| 4 | Carousel (1:1) | 3–4 before→after pairs from portfolio |
| 5 | Static hero (4:5 + 9:16) | Cinematic after-shot, eligibility question |

Each ad carries up to 5 primary texts + 3–5 headlines spanning the variation
axes (scarcity / transformation / social-proof / question / mechanics).

Assets: statics exist in `public/funnels/{kitchens,bathrooms}/ads/`. Reels
selected from `video/out/` inventory (Claude proposes 2 per trade; Oliver
vetoes/swaps before sync), copied into `public/funnels/<slug>/ads/videos/`
(gitignored). Each video ad gets a generated `thumbnailFile`. Carousel cards
composited from portfolio R2 media (1:1). Reel overlay text audited against
current Reels safe zones (top ~14%, bottom ~20%, sides 6%). Any AI-modified
creative flagged for the AI-disclosure toggle.

Refresh cadence (post-launch operating rule): monthly, kill bottom 1–2 ads by
cost-per-qualified-lead, add 2–3 net-new concepts per product; never nuke the
ad set; winners run 8–12+ weeks until frequency >3 + CTR decay >25% + CPM
+35% co-occur.

## 3. Rename-obsolete (one-off, not committed)

A throwaway tsx script (scratchpad, reusing the engine's Meta client + env
loading) that fetches every campaign in the account, excludes the managed
Showcase campaign, and renames the rest to `[OLD] <name>`. Dry-run print first;
execute after Oliver eyeballs the list. Rename only — no status/delete writes.
Oliver then deletes `[OLD]` campaigns manually in Ads Manager at his leisure.
Nothing lands in `package.json` or the repo.

## 4. New-lead notification (generic)

`notificationService.notifyNewLead` — **generic across lead sources**, not
funnel-specific:

- Params: `{ customerId, source }` (source = human-readable origin, e.g.
  "Kitchens funnel"). Looks up customer, builds title/body, resolves recipients.
- Recipients from a config constant (Oliver only for now; list is the extension
  point — no code change beyond the constant to widen later).
- **Push** via existing `sendPushToUser` pipeline: "New lead — Kitchens funnel"
  / "{name} · {city} {ZIP}", deep-link to the customer via `ROOTS`.
- **Email** via existing `email.service` (Resend): same content, simple branded
  email to info@triprosremodeling.com with dashboard link.
- Trigger: fire-and-forget (`void` + `.catch`) from the funnel ingest mutation
  (`funnels.router.ts` → after `customerIntakeService.ingestLead` succeeds).
  Other sources (Bina webhook, manual intake) can call the same method later —
  out of scope today.
- Verify on dev: `pnpm push:test` for the pipeline, then one real dev funnel
  submission end-to-end (push + email received).

## 5. Doc corrections (in scope)

`scripts/meta/DOCS.md#optimization-ladder` is stale — the "graduate an ad set
to SCHEDULE at ~50 Schedule conversions/week" rule is mathematically
unreachable at this spend, and Conversion-Leads-style optimization is
instant-forms-only (not available for website leads). Rewrite:

- Stay on `LEAD` as the optimization event; the server-side renter gate is the
  quality lever (every future disqualifier belongs in that gate).
- Wire Schedule via CAPI for **measurement** — cost-per-Schedule (custom
  conversion) becomes the creative/ad-set scoreboard, replacing CPL.
- Test Schedule optimization only at ~15–25 Schedules/week account-wide, in a
  parallel ad set, accepting Learning Limited.
- Add: ABO rationale, 7-day-click attribution, Housing-SAC fallback note,
  learning-reset hygiene (≤20% budget moves).

## 6. Out of scope → funnel event-model redesign (handoff)

Oliver wants the funnel's pixel/CAPI event ladder rethought end-to-end
(PageView → engagement → ZIP → CompleteRegistration at PII → Lead at
confirmation → server-side Schedule/Purchase on appointment-set) with
KPI/drop-off analytics designed in. That is a separate session's project:
**`docs/plans/2026-07-26-funnel-event-model-redesign-handoff.md`** is the
handoff prompt. This launch proceeds on the *current* event model (optimize on
`LEAD` as it fires today); the campaign spec does not change when the event
remap ships — but ideally the remap lands before or shortly after activation,
since changing what `Lead` means mid-flight adds learning noise.

## 7. Launch runbook (today)

1. Notification slice → verified on dev (push + email received).
2. Creatives staged (reels copied + thumbnails + carousel cards) → Oliver
   approves reel picks.
3. `showcase.campaign.ts` + engine additions → `pnpm meta sync` dry-run →
   review plan → `--apply` → full tree lands PAUSED → spot-check in Ads Manager.
4. One-off rename script → dry-run list → execute → all non-Showcase campaigns
   read `[OLD] …`.
5. `pnpm lint && pnpm tsc`.
6. **Oliver in Ads Manager**: verify tree + creatives + AI-disclosure toggles,
   pause the [GM] pair, flip Showcase ACTIVE, delete `[OLD]` campaigns whenever.
7. 72h monitoring; no edits >20%; first refresh checkpoint week 4–6.

## Error handling & testing

- Sync failures mid-run are already safe (lock updated per successful call;
  re-run resumes). Missing asset on disk → ad skipped with warning, rest
  proceeds.
- Notification failures never block ingest (fire-and-forget + logged partial
  failures).
- Rename script: dry-run gate; renames are trivially reversible by hand.
- Verification: `pnpm lint` + `pnpm tsc`; dev funnel submission for the
  notification slice; Ads Manager visual check for the Meta tree (never
  headless-browse the pixel — real browser only).
