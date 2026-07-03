# Meta Campaign Engine — Launch-Ready Pipeline (Design)

**Date:** 2026-07-03
**Status:** Approved in brainstorming (session with Oliver)
**Supersedes:** `docs/plans/meta-ads-compound-intelligence.md` campaign/creative sections
(that doc still designs around the retired Equity Reset / StormGuard `/lp/*` programs;
its guardrail philosophy and KPI ranking carry forward, its campaign architecture does not).
**Companions:** `docs/plans/meta-capi-phase2-handoff.md` (CRM→CAPI events; re-prioritized
by this design — `Schedule` first), `src/shared/services/providers/meta/DOCS.md`
(measurement invariants).

## Goal

Stand up programmatic, git-auditable control of the Tri Pros Meta ad account:
campaigns / ad sets / ads / targeting created and managed as code, wired to the live
kitchens & bathrooms funnels (`kitchens.triprosremodeling.com`,
`bathrooms.triprosremodeling.com`), with the already-shipped pixel + CAPI measurement
loop verified in production before a dollar is spent.

## Credential audit (verified 2026-07-03)

All env vars live in `.env` (`.env.meta` retired). `META_ACCESS_TOKEN` is a
**System User token** (never expires) on app `tpr-marketing-manager-app` with
`ads_management`, `ads_read`, `business_management`, `pages_manage_ads`,
`leads_retrieval`, `read_insights` — sufficient for full Marketing API control.
Ad account `act_1552723459154642`, page `661917947005358`, dataset/pixel
`2031257387425754`. No further Meta approvals needed.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Scope | Launch-ready pipeline first; CAPI Phase 2 + retargeting + automation as fast-follows in this same plan. Full automation loops (auto-pause rules, cron optimization) remain a separate future project. |
| Campaigns | Two: Kitchens + Bathrooms. Retargeting and complete-interior deferred. |
| Creatives | Images now (high-res portfolio/before-after), videos fast-follow. |
| Geo | Service-area ZIPs imported from the funnel gate's source module — ads never target a ZIP the funnel rejects. |
| Config management | Campaign-as-code: typed specs in repo + `pnpm meta sync` diff/apply engine. |
| Optimization | Launch on `Lead`; graduate ad sets to **`Schedule`** (appointment set) once the event flows and volume supports it. `Schedule` = Meta standard event, fired via CAPI when a Meta-attributed lead gets its first meeting created. (Overrides the earlier "graduate to MeetingComplete" decision in the Phase 2 handoff.) |
| Asset location | `public/funnels/<slug>/ads/` — images committed, videos gitignored, ad copy typed in the campaign spec (never in `public/`, which is publicly served). |

## Campaign structure & budget

```
Campaign: TPR — Kitchens — Leads        $58/day (~$1,750/mo)   OUTCOME_LEADS
  └─ Ad Set: Service-Area ZIPs · 35–70 · optimize Lead → Schedule
       └─ 2–3 image ads → https://kitchens.triprosremodeling.com/?utm_…
Campaign: TPR — Bathrooms — Leads       $58/day (~$1,750/mo)   OUTCOME_LEADS
  └─ Ad Set: Service-Area ZIPs · 35–70 · optimize Lead → Schedule
       └─ 2–3 image ads → https://bathrooms.triprosremodeling.com/?utm_…
```

- $3,500/mo committed of the $5,000/mo ceiling; ~$1,500 reserved for retargeting +
  creative-testing fast-follows.
- Targeting: ZIP-level geo, age 35–70, Advantage+ placements, lowest-cost bidding
  (`LOWEST_COST_WITHOUT_CAP`).
- UTM convention on every ad link: `utm_source=meta&utm_medium=paid&utm_campaign={campaign}&utm_content={ad}`
  (+ Meta appends `fbclid`). Funnels already persist these into `leadMetaJSON`.

## Phases

### Phase 0 — Measurement go-live verification (gates everything)

Ads without a verified pixel loop = burned money. Steps:

1. Vercel prod env: `NEXT_PUBLIC_META_PIXEL_ID`, `META_DATASET_ID`, `META_CAPI_TOKEN`
   present; `META_TEST_EVENT_CODE` **absent** (server-env hard-fails prod boot if set).
2. Deploy-verify: pixel fires on `kitchens.`/`bathrooms.triprosremodeling.com`; silent
   on `*.vercel.app` previews (host gate) — real browser, never headless (Meta
   BotBlocking silently drops automation beacons).
3. Test Events panel: `Lead` appears as ONE merged "Browser · Server" event
   (dedup working), EMQ ≥ 6.
4. Housekeeping: ads CLI Graph client bumps v21.0 → shared `META_GRAPH_VERSION`
   constant (v23.0) from `providers/meta/constants`; retire the stale
   `initialize-account` Equity-Reset-era flow.

### Phase 1 — Campaign-as-code engine (`pnpm meta sync`)

```
scripts/meta/campaign-specs/
  kitchens.campaign.ts        ← typed spec (budget, targeting, ads incl. copy)
  bathrooms.campaign.ts
  lib/define-campaign.ts      ← builder + zod validation
  lib/guardrails.ts           ← budget ceiling, no-auto-activate, no-delete
scripts/meta/meta.lock.json   ← committed; spec key → Meta ID mapping
scripts/meta/logs/            ← gitignored; sync-history.jsonl audit trail
```

Sync flow:
1. Read + zod-validate specs → run guardrails (Σ daily budgets ≤ $166/day → refuse).
2. Fetch actual state (campaigns/adsets/ads) from Marketing API.
3. Match via `meta.lock.json` (terraform-state-lite); deterministic names as fallback
   to adopt pre-existing objects.
4. Print plan (`+ create`, `~ update`, `⏸ orphan`). **Dry-run is default; `--apply`
   executes.**
5. Apply rules: creates always `PAUSED`; updates never touch `status`; deletes never
   happen (orphans flagged; paused only with an explicit flag). Every apply appends
   plan + result to `logs/sync-history.jsonl`.

Geo source: specs import the service-area ZIP list from
`src/shared/constants/company/service-area-zips.ts` — the same source the funnel ZIP
gate resolves against (`@/` alias works under tsx) — transformed to Meta
`geo_locations.zips` (`US:{zip}`) format.

Idempotency: re-running a partially-failed apply resumes from the lock file, never
duplicates. Graph errors surface verbatim; rate limits get exponential backoff.

### Phase 2 — Creatives pipeline

```
public/funnels/kitchens/ads/
  hero-remodel-01.jpg          ← committed; high-res JPG/PNG (1080px+ source
  before-after-02.jpg             quality — NOT the compressed funnel webps)
  videos/                      ← gitignored; CLI uploads from disk, site never
                                  serves them (deploy/clone bloat otherwise)
```

- Ad copy (primary text / headline / description variants) lives **typed in the
  campaign spec** — git-reviewed, and never in `public/` (everything there is
  publicly served; `…/ads/PROGRAM.md` would leak ad strategy at a guessable URL).
- Sync scans the ads dir → uploads new images (`/adimages`, content-hash dedup via
  lock file) → builds link-ad creatives with the UTM'd funnel URL → creates ads
  PAUSED. Videos: same flow via `/advideos` when files appear.

### Phase 3 — Launch + fast-follows

Launch: `sync --apply` → Oliver reviews structure/creatives in Ads Manager →
**Oliver flips ACTIVE manually**. Nothing in the engine ever activates anything.

Fast-follow order:
- **A. `Schedule` CAPI event (top priority — re-prioritizes the Phase 2 handoff).**
  - Trigger: meeting-creation entity hook; **first meeting per customer only** —
    deterministic `event_id` = `Schedule:{customerId}` makes retries and subsequent
    meetings no-ops at Meta's dedup layer.
  - Meta-attribution check: lead has `fbclid`/`_fbp` persisted in `leadMetaJSON`;
    non-Meta leads don't fire (don't teach Meta about telemarketing leads).
  - Payload: `user_data` rebuilt from customer via DAL (ph/fn/ln/ct/st/zp +
    external_id + fbp/fbc), `action_source: system_generated`, real meeting-created
    timestamp. Dispatch: `void metaCapiEventJob.dispatch(...)` (cosmetic criticality).
  - Remaining handoff events (CompleteRegistration twin, MeetingComplete,
    ProposalSent, Contact, Purchase w/ value+currency) ship after, for measurement.
- **B. Optimization graduation:** flip ad set `optimization_goal` Lead → `Schedule`
  once events flow and volume approaches Meta's ~50 conversions/ad-set/week
  learning threshold. Below that, stay on Lead (learning stalls otherwise).
- **C. Retargeting campaign** (30-day visitor custom audience) from the reserved
  budget once the pixel visitor pool has volume.
- **D. Richer reporting** (`pnpm meta performance` → adset/ad level, CPL/CTL/CTA).
  Automated optimization loops = separate future project.

## Verification gates (each phase blocks the next)

| Phase | Gate |
|---|---|
| 0 | Test Events: ONE deduped Lead ("Browser · Server"), EMQ ≥ 6, on real prod domain |
| 1 | Dry-run plan reviewed by Oliver; post-apply Ads Manager matches spec exactly, all PAUSED |
| 2 | Creatives render in Ads Manager preview; ad link lands on funnel with UTMs captured in `leadMetaJSON` |
| 3A | Test meeting for a Meta-attributed dev lead → `Schedule` in Test Events with expected match keys |

## Engine-level guardrails (hard-coded, not policy)

- Budget ceiling: refuse apply if Σ daily budgets > $166/day (~$5K/mo).
- Creates always PAUSED; activation is human-only in Ads Manager.
- Updates never modify `status`; deletes never happen.
- Committed lock file + gitignored JSONL audit log of every apply.

## Out of scope (explicitly)

- Automated optimization loops (auto-pause on CPL/CTR floors, budget shifting,
  creative rotation cron) — future project; the audit-log + insights seams are the
  extension points.
- complete-interior campaign, Meta Lead Forms, Advantage+ Shopping campaigns.
- Neon-mirrored campaign entities / dashboard views (deferred until automation needs
  insights history).
