# Showcase Ads — Optimization Round 1 (Kitchens Double-Down) — Epic Charter

> **Position:** After the **Showcase campaign launch** (live 2026-07-26, `docs/superpowers/specs/2026-07-26-showcase-campaign-launch-design.md`) and the **campaign engine** (`docs/superpowers/specs/2026-07-03-meta-campaign-engine-design.md`). This is the **first data-driven optimization round** — the account has ~14 days of real spend, and we now act on it. It runs end-to-end from spend consolidation → creative → budget scale → measurement → the resumed analytics dashboard.

> **For agentic workers:** this is an **epic charter**, not a single implementation plan. It decomposes into five sub-plans, each of which gets its own `writing-plans` implementation plan and its own execution run, in the sequence under **Decomposition**. Several sub-plans are **operational** (Ads-Manager actions + campaign-as-code edits), not pure code PRs — the epic tracks both. **Analytics (Sub-plan 5) is deliberately LAST** — "cross that bridge when we get there."

**Goal:** Lower blended cost-per-lead by (a) folding the under-performing bathrooms ad set into kitchens, (b) concentrating delivery on the proven quartzite creative and starving the pricier Scout reel, (c) adding **one** fresh, genuinely-different quartzite concept, (d) ramping the kitchens budget **as the creative earns it** (≤20%/move), and (e) standing up a durable performance scoreboard — culminating in the resumed super-admin analytics dashboard.

**System (in one breath):** One Meta campaign `showcase` ("TPR — Showcase — Leads"), ABO ad sets defined as code in `scripts/meta/campaign-specs/showcase.campaign.ts`, synced via `pnpm meta sync` (dry-run) / `--apply` against `scripts/meta/meta.lock.json`. The engine **creates PAUSED, never activates, never pauses, never deletes** — activation and pausing are human-only in Ads Manager. Creative is produced via the `showcase-ads` skill (Higgsfield clips/VO/music → Remotion `video/` package, gitignored) and published to `public/funnels/<slug>/ads/`.

**Tooling stack:** `scripts/meta` campaign-as-code (typed specs + Zod + lock file) · Meta Graph Marketing API (`scripts/meta/lib/client.ts`) · read-only insights reporter `pnpm meta insights` (**shipped this round**) · Higgsfield CLI + Remotion (`video/`) · Neon/Postgres portfolio `before_after_pairs_json` + public R2 for creative sources · analytics engine `src/shared/domains/analytics/` + customers DAL `entities/customers/dal/server/ad-performance.ts`.

---

## Global Constraints

- **Activation & pausing are HUMAN-ONLY.** The engine will never flip status. Every "pause X" / "activate X" step in this epic is an owner action in Ads Manager. The engine only creates (PAUSED), updates non-status fields, and reports orphans.
- **Removing an object from a spec does NOT stop it.** It becomes a reported orphan (`diff.ts` "⏸ unmanaged"), still spending if ACTIVE. Therefore **pause-in-Ads-Manager must precede or accompany any spec removal.**
- **Budget changes ≤20% per move** (`scripts/meta/DOCS.md#campaign-as-offer` + Meta learning-phase reality). Larger jumps reset learning; the ramp (Sub-plan 3) honors this.
- **Budget ceiling $166/day** (`assertBudgetCeiling`, hard guardrail). Round 1 stays far under it (kitchens tops out at $116/day; bathrooms → $0).
- **Work on `main`; stage by explicit path** — never `git add -A`. Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Commit only when asked.
- **No `pnpm build`** — verify with `pnpm tsc` + `pnpm lint`. Every `--apply` is preceded by a dry-run whose plan is reviewed.
- **`video/` is gitignored/local-only.** Props JSON + the variation ledger are durable local files; "save" there means writing the file. Only `public/funnels/**/ads/` (committed images/thumbs) and `scripts/meta/**` (specs, lock) are git-tracked.
- **Creative truthfulness + AI disclosure.** Before→after only from genuine same-room portfolio pairs; AI clips/synthetic VO ⇒ tick "AI Info" in Ads Manager; no photoreal AI faces (crew posed from behind). Copy obeys `docs/marketing/showcase-offer.md` (APPLY_NOW, never GET_QUOTE, no pricing, multi-text variants).
- **Trust-but-verify:** confirm any documented rule against code before asserting it; ping on staleness (this epic already surfaces one — see the ledger drift below).

---

## Context & Motivation — what the data says (14-day live window, 7-day-click)

Pulled 2026-08-09 via the new `pnpm meta insights` (ad-level; leads extracted from `actions`, ad_id→specKey via the lock).

**Ad-set level:**

| Ad set | Spend | Leads | Blended CPL |
|---|---|---|---|
| **Kitchens** | $459.50 | 7 | **$65.64** |
| **Bathrooms** | $700.44 | 6 | **$116.74** |

Kitchens produces leads **~44% cheaper** than bathrooms. → **Fold bathrooms into kitchens** (owner directive, data-validated).

**Inside kitchens — Meta is starving the best ad:**

| Kitchen ad (spec key) | Live asset | Spend | Leads | CPL |
|---|---|---|---|---|
| `kitchens-casting-reel-01` | reel-07 (old "Scout", **non-quartzite**) | $375.06 | 5 | **$75.01** |
| `kitchens-story-reel-01` | reel-08 (**quartzite** "Rachelle") | $59.98 | 2 | **$29.99** |
| `kitchens-before-after-01` / `-portfolio-carousel-01` / `-hero-01` | static cards | ~$24 total | 0 | — |

**Findings that drive the plan:**
1. **The quartzite reel converts at <½ the CPL of the Scout reel Meta funds with 82% of spend.** Concentrating delivery on quartzite is the single biggest lever.
2. **Statics get ~zero delivery and zero leads in both ad sets** — video carries the account; statics are not the lever (harmless, not helpful).
3. **Kitchens is delivery-constrained, not budget-constrained** — it spent ~$33/day against a $58/day cap. Raising the cap alone won't lift spend; better creative unlocks delivery, then budget follows.
4. **Frequency 1.1–1.5** — no fatigue yet; the problem is allocation + creative quality, not burnout.
5. **Honesty caveat:** samples are small (2–5 leads/ad). Signals are directional; treat the quartzite win as "press it and confirm," not "proven."

**Owner decisions ratified for this round (2026-08-09):**
- Kitchens A/B → **cut Scout, back quartzite** (pause reel-07; concentrate on reel-08 + one new *different-concept* quartzite reel).
- Budget → **staged ramp $58→$116** over ~2 weeks (≤20%/move), not one jump.
- Structure → **this in-repo epic**, analytics last.
- Promotion → **Showcase continues**; a new promotion as a separate campaign is parked (Non-goals).

**⚠️ Staleness ping (to reconcile in Sub-plan 1):** `video/props/variation-ledger.md` still records the quartzite reel as *"draft — not published,"* but the "Rachelle" cut has been **LIVE as reel-08 since 2026-07-30** (byte-identical), and the Hale/Rachelle/font-matrix variants were never logged. Ledger has drifted from reality.

---

## Architecture / Approach Decisions & Rationale

| Decision | Rationale |
|---|---|
| **Consolidate to one ad set (kitchens), fold bathrooms out** | Kitchens' CPL is ~44% lower on real data; ABO doctrine says one ad set per product and never fragment the learning phase. Bathrooms paused (owner), removed from spec (orphaned). |
| **Cut Scout reel-07 rather than let Meta self-correct** | Meta locked early onto reel-07 and over-funds it at 2.5× the quartzite CPL. Pausing it forces delivery onto the efficient creative + the new concept. Accepts a small learning wobble for a large allocation win. |
| **Add ONE new quartzite reel — a different concept, not a VO/font variant** | Near-duplicate reels collapse under Meta ranking and compete with themselves. The 7 existing quartzite renders are variants of *one* concept (for picking, not simultaneous A/B). The 2nd slot needs a genuinely different hook/footage/pacing per the variation ledger's hard rule. |
| **Keep the statics in-spec (don't prune)** | They cost ~nothing and Meta self-selects away from them; pruning them adds orphan noise for no CPL gain. Revisit only if they ever start eating spend. |
| **Ramp budget ≤20%/move, gated on CPL stability, only after the creative lands** | Kitchens is delivery-constrained; raising the cap before creative can absorb it just widens an unused ceiling. Ramp as leads-at-target materialize. |
| **Ship the read-only `pnpm meta insights` reporter now; defer the dashboard** | The insights sync already works; a terminal report unblocks *this round's* decisions in hours. The full super-admin dashboard (analytics Plans 3–6) is the strategic capstone, not a blocker. |

---

## Decomposition (the mini epic)

Five sub-plans. Ordering is mostly sequential; Sub-plan 4 (measurement) runs continuously alongside 1–3. **Sub-plan 5 (analytics) is last and blocked by the operational round completing.**

```
SP1 Consolidate & stop the bleed ──► SP2 Creative: new quartzite concept + polish ──► SP3 Staged budget ramp
        │                                     │                                              │
        └───────────────── SP4 Measurement cadence (continuous, spans SP1–SP3) ─────────────┘
                                                                                             ▼
                                                              SP5 Analytics dashboard resume (LAST)
```

### Sub-plan 1 — Consolidation & bleed-stop (FOUNDATION)

**Outcome:** Bathrooms spend stopped and folded out of the spec; the pricey Scout reel cut; kitchens on ramp-step-1 budget; the quartzite ledger reconciled to reality.

Scope:
- **Owner (Ads Manager):** pause the **bathrooms ad set** (stops ~$58/day at $117 CPL) and pause **`kitchens-casting-reel-01` (reel-07)** — both before/with the spec `--apply`.
- **Spec edit (`showcase.campaign.ts`):** remove the entire `bathrooms` ad-set block; set kitchens `dailyBudgetCents` `5_800 → 6_900` ($58 → $69, ramp step 1). Decide the reel-07 slot's fate here: hold it in-spec but paused, **or** repoint its `videoFile`/`thumbnailFile` to the new reel from SP2 (preferred end-state — reuses the ad key, no orphan). If SP2's reel isn't ready, hold paused and repoint in SP2.
- **Sync:** `pnpm meta sync` (dry-run) → review plan (expect: `~ update ad set showcase/kitchens` for the budget; `⏸ unmanaged` for the 5 bathrooms objects) → `--apply` → commit `meta.lock.json` + spec.
- **Ledger reconcile (`video/props/variation-ledger.md`, local):** record reel-08 = quartzite "Rachelle" LIVE since 2026-07-30; append the Hale/Rachelle/font-matrix variant rows that were never logged.

**Gates / risks:** bathrooms must be paused first or it keeps spending post-removal. Verify the dry-run plan shows no `create`/`delete` surprises. Confirm the reel-07 thumbnail lives at `public/funnels/kitchens/ads/reel-07-thumb.jpg` (spec references it) before any re-sync — a missing asset silently skips that ad.

### Sub-plan 2 — Creative: new quartzite concept + hook/quality polish

**Outcome:** The kitchens ad set runs the proven quartzite reel-08 **plus** one new, genuinely-different quartzite concept; the live quartzite creative is polished to hook scrollers.

Scope (via the `showcase-ads` skill):
- **HITL pick (gates the build):** owner reviews the 7 existing quartzite renders (`video/out/qz-*`, `kitchens-quartzite-glow*`) **and** the two new raw files that appeared 2026-08-02 (`/mnt/c/Users/porat/Downloads/kitchen-quartzite-glow-finished-raw.mp4`, `...-installation-raw.mp4`) and sets direction for the 2nd reel.
- **Build one new reel** — a different concept from reel-08 (different hook family / lead footage / pacing / music / VO per the variation ledger's hard rule; base-pair + creative-direction approved at one combined HITL gate). Follow the media chain-of-custody + walkthrough + captions recipes. Append the ledger row in the same session.
- **Hook/quality polish pass** on the live quartzite reel(s) (owner's "higher-quality, hook scrollers" ask): QA frames at each beat, verify safe rects (x 65–1015, y 420–1248), caption legibility, logo dock, hook timing, music/VO mix — smallest-change re-renders per edit mode.
- **Publish:** render → `public/funnels/kitchens/ads/videos/<file>.mp4` + committed thumbnail → add/repoint the ad in `showcase.campaign.ts` → `pnpm meta sync --apply` (lands PAUSED) → owner activates + ticks "AI Info".

**Gates / risks:** do not run multiple near-duplicate quartzite variants as separate ads. Every publish lands PAUSED; owner activation only. AI clips ⇒ AI-Info disclosure.

### Sub-plan 3 — Staged budget ramp $69 → $116

**Outcome:** Kitchens at $116/day, reached without a learning-destroying jump, only as the creative earns delivery.

Scope:
- Ramp steps (each a `dailyBudgetCents` edit + dry-run + `--apply`, ≤20%/move): **$69 → $82 → $98 → $116** (`6_900 → 8_200 → 9_800 → 11_600`).
- **Gate each step on the prior step holding** (CPL not degrading, spend actually rising into the cap). If a step regresses CPL, hold or step back before continuing.
- Spread over ~2 weeks; do not advance faster than delivery justifies.

**Gates / risks:** ramp only *after* SP2 creative is live and absorbing spend (raising the cap on delivery-constrained creative is a no-op). Stays under the $166 ceiling by construction.

### Sub-plan 4 — Measurement cadence + baseline thresholds (continuous)

**Outcome:** A repeatable performance scoreboard and written target ranges, so decisions are evidence-based, not vibes.

Scope:
- **Already shipped:** `pnpm meta insights [date_preset]` — read-only ad-level spend/leads/CPL/LPV/CTR/CPC/frequency, grouped by ad set with a blended roll-up (`scripts/meta/reports/pull-ad-insights.ts`). Registered as `meta insights` in `scripts/meta/index.ts`.
- Establish a weekly review cadence on the `last_14d`/`last_28d` windows (2–4-week judgment horizon per `scripts/meta/DOCS.md`).
- **Baseline the rungs after ~2 weeks** of the new setup: write down target CPL/CTR/frequency ranges per creative so SP2/SP3 gates are objective.
- Optional additions on demand: per-day trend flag, cost-per-Schedule column (Schedule CAPI is the measurement event) once volume supports it.

### Sub-plan 5 — Analytics dashboard resume (LAST — "cross that bridge when we get there")

**Outcome:** A super-admin, in-app Marketing (then Sales) analytics view — the durable successor to the CLI. Explicitly deferred until the operational round (SP1–SP4) is done.

Scope (resumes the existing analytics track; engine + all four data sources already built and DAL-compliant, but no bucket/resolver-call/router/UI exists yet — a super-admin can view **zero** analytics today):
- **Plan 3** (`docs/superpowers/plans/2026-07-30-analytics-marketing-bucket.md`, written, zero code): resolver anchor/left-join in `types.ts` + `resolver.ts` (honest blended CPL over the full ad-spend keyset, not just converting ads) → `buckets/marketing.ts` → `buckets/index.ts` registry.
- **Plans 4–6 (not yet authored):** Sales bucket → `analytics_snapshots` table + snapshot job → `superAdminProcedure` router + `features/analytics/` UI. Each gets its own `writing-plans` plan when reached.
- **Deploy note carried forward:** `meta-insights-sync.service` reads `scripts/meta/meta.lock.json` via `fs`; the Plan-6 route/job needs `outputFileTracingIncludes` to bundle that lock on Vercel.

---

## Cross-cutting: change summary

- **`scripts/meta/campaign-specs/showcase.campaign.ts`** — remove `bathrooms` ad set (SP1); kitchens budget edits (SP1 step 1, SP3 steps 2–4); add/repoint the new quartzite ad (SP2).
- **`scripts/meta/meta.lock.json`** — updated by each `--apply` (committed).
- **`scripts/meta/reports/pull-ad-insights.ts` + `scripts/meta/index.ts`** — ✅ new `meta insights` command (SP4, shipped; currently unstaged).
- **`video/props/*` + `video/props/variation-ledger.md`** (local) — new reel props + ledger reconcile + new row (SP1/SP2).
- **`public/funnels/kitchens/ads/`** — new committed video + thumbnail (SP2).
- **`src/shared/domains/analytics/**` + `entities/customers/dal/server/ad-performance.ts` + new `src/features/analytics/`** — SP5 only.

## Testing & Validation Strategy

- `pnpm tsc` + `pnpm lint` clean per code change (no unit runner for scripts; `paginate-captions` etc. keep their existing tests).
- **Every Meta write is dry-run-reviewed before `--apply`;** confirm the printed plan matches intent (correct op types, no unexpected create/orphan).
- **Post-change verification:** re-run `pnpm meta insights` after each step; confirm bathrooms drops to $0 spend, kitchens delivery rises into the new cap, and the quartzite ads gain share.
- **Creative QA:** extract render frames at each beat; verify safe rects, captions, logo, hook; owner review before publish; PAUSED-then-activate.
- **Meta measurement caution:** validate pixel/Lead events via Events Manager / Pixel Helper in a **real browser** (never headless — BotBlocking).

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Spec removal leaves bathrooms spending | Owner pauses bathrooms in Ads Manager **before** `--apply`; verify $0 spend post-cutover via `meta insights`. |
| Cutting Scout tanks total volume before new creative lands | Sequence SP1 pause with SP2 creative ready (or hold reel-07 paused only briefly); the quartzite reel already carries leads at low CPL. |
| Two near-duplicate quartzite reels compete | SP2 mandates a *different concept* for the 2nd slot; variants are for picking, not simultaneous A/B. |
| Budget jump resets learning | Staged ≤20%/move ramp (SP3), gated on CPL stability. |
| Small-sample over-fitting | Judge on 2–4-week windows; treat single-ad CPLs as directional; SP4 baselines thresholds before hard cuts. |
| Ledger drift misleads future sessions | SP1 reconciles `variation-ledger.md` to the live reality. |
| Activating from code | Impossible by design (engine never sets status); all activation stays owner-only. |

## Relationship to existing backlog

- **Meta Ads Campaign Strategy** memory (`project-meta-ads-strategy.md`) + `scripts/meta/DOCS.md` — canonical for structure/doctrine; this epic is the first optimization application of it.
- **Analytics framework** (`project-analytics-framework.md`, `docs/superpowers/plans/2026-07-*-analytics-*`) — SP5 resumes it; nothing here changes its architecture.
- **Meta Pixel + CAPI** (`project-meta-pixel-capi.md`) — Lead/Schedule events unchanged; Schedule remains a measurement (not optimization) event.

## Non-goals

- A **new promotion / separate campaign** beyond Showcase (parked by owner; Showcase continues this round).
- Reviving or re-optimizing **bathrooms** (paused/orphaned this round; a future round may relaunch it as its own thing).
- **SCHEDULE optimization** (stay on LEAD; revisit only at ~15–25 Schedules/week account-wide per the optimization ladder).
- Any **activation/pausing from code** (human-only, permanent guardrail).
- Building the **analytics UI now** — it is SP5, last, and starts only after the operational round.
