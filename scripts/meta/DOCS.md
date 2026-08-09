# scripts/meta — Campaign Engine

CLI tooling for Tri Pros Meta ad account. Manages campaigns, ad sets, and ads as
versioned code. Entry point: `pnpm meta sync` (dry-run) / `pnpm meta sync --apply`.

Design spec: `docs/superpowers/specs/2026-07-03-meta-campaign-engine-design.md`.
Measurement invariants: `src/shared/services/providers/meta/DOCS.md`.

## showcase-offer

Every campaign spec sells the **Showcase offer** — canonical definition,
approved vocabulary, and ad rules (incl. CTA rules: `APPLY_NOW`/`LEARN_MORE`,
never `GET_QUOTE`) live in `docs/marketing/showcase-offer.md`. Read it BEFORE
writing or editing ad copy in `campaign-specs/*.campaign.ts`.

## campaign-as-offer

Structure doctrine (research-validated 2026-07-26, spec:
`docs/superpowers/specs/2026-07-26-showcase-campaign-launch-design.md`):

- **Campaign = offer.** One campaign per offer (`showcase`). A new offer = a new
  spec file composing the same building blocks (`defineCampaign`, geo, guardrails,
  ad formats) — never a copy-paste of an old spec.
- **Ad set = product.** The ONLY sanctioned ad-set split (different landing pages
  + per-product budget guarantees). Never split by interests/demographics — the
  learning phase lives per ad set and fragmentation starves it.
- **ABO, not CBO.** Budgets live on ad sets. With identical audiences, CBO
  arbitrates on cheapest lead and over-funds the cheaper product.
- **Naming:** campaign key = offer slug; ad set key = product slug; ad key =
  `<product>-<concept>-<nn>` (unique campaign-wide — ad lock keys are
  `<campaignKey>/<adKey>`).
- **5 distinct concepts per ad set** (2 reels / before-after static / carousel /
  hero static), copy variation INSIDE each ad via multiple text options (≤5
  primary texts). Near-duplicate ads collapse under Meta's ranking — vary
  concepts across ads, text within them.
- **Settings:** Advantage+ audience ON (geo is the hard control; age 35–65+
  rides as an Advantage+ suggestion — hard age_min caps at 25 under A+
  audience), attribution 7-day click only, highest-volume bidding, 24/7.
- **Learning reality:** at ~$58/day/ad set, "Learning Limited" is permanent and
  fine. Judge on 2–4-week windows. Budget changes ≤20% per move; never duplicate
  ad sets to test.
- **Housing-SAC fallback:** if Meta ever flags remodeling as the housing special
  category, ZIP lists + age floors lock; fallback = 15-mile radius, 18–65+.

Still-image creative requirements: `docs/marketing/stills/still-ad-standard.md`.

## campaign-as-code

Specs in `scripts/meta/campaign-specs/` are the single source of truth for all
**managed** objects. A managed object is one whose key appears in `meta.lock.json`.
Anything else in the account is an **orphan** — reported by sync, never touched.

Editing a spec field and running `--apply` overwrites the corresponding Meta object
on the next sync. The one exception is **`status`**: sync never reads or writes it.
Activation (campaign/ad set/ad → ACTIVE) is human-only in Ads Manager.

Ad copy (headline, primary text, description) lives typed in the campaign spec, not
in `public/` (everything there is publicly served and guessable). Image files live in
`public/funnels/<funnelSlug>/ads/` where `funnelSlug` is set **per ad set**
(committed, high-res source — NOT the compressed funnel WebPs). Video files live in `public/funnels/<funnelSlug>/ads/videos/`
(gitignored — too large to commit; the lock's `videos` map is the durable
sha → Meta-video-id record). Missing asset on disk → that ad is skipped with a
warning; the rest of the plan still runs.

Ads support three formats via the spec `format` field: `single-image` (default —
specs without `format` parse unchanged), `carousel` (2–10 cards, one shared
primary text), and `video` (uploaded + polled until processed; requires a
`thumbnailFile` image).

Campaign specs are validated on load via `defineCampaign` (Zod). The registry
(`campaign-specs/registry.ts`) exports `CAMPAIGN_SPECS`; all other tooling imports
from there.

## hard-guardrails

These are hard-coded invariants, not operator policy. They cannot be bypassed by any
flag or config.

- **Creates always PAUSED.** Every campaign, ad set, and ad is created with
  `status: PAUSED`. The engine never activates anything.
- **Updates never send `status`.** Updates re-send the full spec-derived body except
  `campaign_id` (immutable) and `status` (never sent).
- **No deletes, ever.** Objects removed from a spec become orphans — reported in the
  plan output, never deleted or paused by the engine.
- **Budget ceiling.** `assertBudgetCeiling` (run before any API call) sums each
  campaign's CBO `dailyBudgetCents` (Advantage Campaign Budget lives on the
  campaign, not the ad sets) and throws if the account-wide total exceeds `16_600`
  ($166/day ≈ $5K/mo). To raise the ceiling, edit the constant in
  `campaign-specs/lib/guardrails.ts` and get a second pair of eyes on the diff.
- **Audit trail.** Every `--apply` appends a JSON line to
  `scripts/meta/logs/sync-history.jsonl` (gitignored). The lock file is committed;
  the log is not.

## lock-file

`scripts/meta/meta.lock.json` maps each spec key to its Meta ID and the fingerprint
it was last synced with — analogous to Terraform state.

**The lock is committed to git.** It is the canonical record of what the engine
manages and the source sync uses to match spec objects to live account objects.

**Self-healing.** If a managed object is manually deleted in Ads Manager, the lock
entry becomes stale. On the next `--apply` sync detects the ID is missing from the
account and re-creates the object from the spec. The lock is then updated
immediately after each successful API call, so a mid-run failure leaves the lock
consistent with whatever did complete — re-running sync resumes safely.

**Conflict resolution.** If the lock and the live account drift in a way sync cannot
auto-resolve (e.g., duplicate named objects from a pre-engine wizard run), re-run
sync. The diff + orphan report surfaces the conflict; decide which objects to keep in
Ads Manager, then update the lock if needed and re-run.

## optimization-ladder

Ad sets optimize on `LEAD` (pixel+CAPI dedup pair, renter-gated server-side) —
and stay there. The old "graduate to SCHEDULE at ~50 conversions/week per ad
set" gate is retired: at ~$58/day and realistic CPLs that volume is ~5x budget
away, and Meta's Conversion-Leads-style optimization is instant-forms-only (not
available for website leads).

The ladder now:

1. **Quality lives in the Lead event.** Every server-side disqualifier (renter
   gate today; future: bad phone, out-of-area) sharpens what Meta trains on.
2. **`Schedule` via CAPI is for measurement, not optimization.** Shipped
   2026-07-27 (funnel event-model Track 1): fired server-only from the
   meetings `create.after` hook, renter-gated, once per lead — full invariant
   in `src/shared/services/providers/meta/DOCS.md`. Cost-per-Schedule (custom
   conversion in Ads Manager) is the creative/ad-set scoreboard, replacing
   CPL. Campaign specs keep `optimizationEvent: 'LEAD'` — `Schedule` is not a
   spec field, it's a reporting/audience event only.
3. Consider testing `SCHEDULE` optimization (parallel ad set, expect permanent
   Learning Limited — Meta's ~50-conversions/week/ad-set learning-phase
   threshold is far above realistic Schedule volume) only at ~15–25 Schedule
   events/week account-wide. Below ~10/week, don't bother.

Funnel event-model redesign shipped 2026-07-27 — design spec:
`docs/superpowers/specs/2026-07-26-funnel-event-model-redesign-design.md`. If
a future change alters the optimization event's name or firing point, update
the campaign spec + this section in the same PR.

## campaign-duplication-runbook

Launching a new offer/campaign on the proven ladder (Lead-optimized, Schedule
for reporting) is five steps:

1. **Declare `contentCategory`** (trade) on the new campaign spec.
2. **The ladder self-wires.** `content_category`/`content_name` params on
   every Pixel/CAPI event follow from the spec — no per-event wiring needed.
3. **Set `optimizationEvent: 'LEAD'`** on every ad set in the spec, then
   `pnpm meta sync` (dry-run) → `pnpm meta sync --apply`.
4. **Apply the saved "Funnel Ladder" Ads Manager column preset** (Spend → LPV
   cost → ViewContent cost → Cost/Lead → Cost/Schedule) to the new
   campaign's view.
5. **One Events Manager validation pass**: Test Events "Open Website" +
   Pixel Helper — confirm `Lead` shows Browser+Server merged (one
   `event_id`), EMQ ≥7, no diagnostics warnings. Then **baseline rung
   thresholds after ~2 weeks** of real spend — write down target ranges per
   ladder rung rather than judging by vibes.
