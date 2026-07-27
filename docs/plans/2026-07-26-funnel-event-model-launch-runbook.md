# Funnel Event-Model Launch Runbook

Oliver-facing checklist for taking Track 1 (leads table + server-side
Lead/CompleteRegistration/Schedule events) live. Follow in order. Steps
marked **[real browser]** must use a real, visible browser session per
`docs/plans/2026-07-26-funnel-event-model-redesign-handoff.md` and the repo's
test-isolation rules — never headless, never Playwright's headless mode.

Canonical design doc: `docs/plans/2026-07-26-funnel-event-model-redesign-handoff.md`.
Preflight evidence for this launch: `.superpowers/sdd/2026-07-26-funnel-event-model-track1/task-8-report.md`.

## 1. Pre-deploy

- [ ] Confirm prod Meta env vars are set on Vercel (Production environment):
  - `NEXT_PUBLIC_META_PIXEL_ID`
  - `META_DATASET_ID`
  - `META_CAPI_TOKEN`
  - **Do NOT set `META_TEST_EVENT_CODE` in prod** — it is a staging-only QA
    toggle (`src/shared/services/providers/meta/lib/config.ts`); server-env
    boot hard-fails if it's set alongside `NODE_ENV=production`, so this is
    self-enforcing, but don't fight it by trying to set it anyway.
- [ ] Run `pnpm db:push:prod` to apply the new `leads` table plus
  `customers.leadId` and `customers.metaScheduleSentAt` columns to prod.
  This is additive and non-destructive (new table, new nullable columns) —
  but it is an explicit prod push. Run it deliberately, not as a side effect
  of an unrelated deploy.

## 2. Deploy

- [ ] Ship the branch to prod (normal deploy flow).

## 3. Real-browser validation — Lead / CompleteRegistration **[real browser]**

Never headless — use Meta Pixel Helper + a real Chrome/Safari tab, per
`feedback-meta-pixel-verify-real-browser.md`.

- [ ] Open Events Manager → Test Events → "Open Website", pointed at a live
  `*.triprosremodeling.com` funnel subdomain (e.g. `kitchens.triprosremodeling.com`).
- [ ] With Pixel Helper active, run the funnel through PII submission with
  test data (ownership = own).
- [ ] Confirm in Test Events:
  - `Lead` (or `CompleteRegistration`, whichever the funnel's step fires)
    shows **Browser + Server merged into one event** — same `event_id`,
    not two separate rows.
  - Event Match Quality (EMQ) is **≥ 7**.
  - Diagnostics panel is clean (no missing recommended parameters, no
    deprecated-parameter warnings).
- [ ] Confirm the pixel does **NOT** fire when visiting the same funnel on
  its `*.vercel.app` preview host (test-vs-live isolation gate). No events
  should appear in Test Events for a `.vercel.app` visit.

## 4. Schedule verification **[real browser / dashboard]**

- [ ] Using a funnel-originated customer (has `leadId` set from step 3, or a
  fresh one), create a meeting for that customer in the dashboard.
- [ ] Confirm the `meta-capi-event` QStash job dispatched (check the QStash
  log / Upstash console for the job).
- [ ] With dev Meta config (`META_TEST_EVENT_CODE`) or in prod via the live
  dataset, confirm `Schedule` lands in Events Manager (Test Events
  non-prod, live Events prod) as a **server-side** event.
- [ ] Confirm `customers.metaScheduleSentAt` is now set for that customer row.
- [ ] Create a **second** meeting for the same customer. Confirm:
  - No second `Schedule` dispatch (marker guard on `metaScheduleSentAt` —
    `see src/shared/services/meta-sync.service.ts`).
  - `metaScheduleSentAt` is unchanged (still the first timestamp).

## 5. Renter exclusion check

- [ ] Run a funnel through to PII submission answering `ownership = rent`.
  Confirm:
  - No `Lead` / `CompleteRegistration` fires (browser or server).
  - `leads` row still gets created (draft), but no `customers.leadId` linkage
    that would trigger a Lead event.
- [ ] Create a meeting for that same rent-answered customer. Confirm no
  `Schedule` fires and `metaScheduleSentAt` stays null.

## 6. Ads Manager — "Funnel Ladder" column preset

Build and save a custom column preset in Ads Manager named **"Funnel Ladder"**
with columns in this order:

1. Spend
2. CPM
3. Link CTR
4. Cost per Landing Page View
5. ViewContents (+ cost per ViewContent)
6. Leads (+ Cost per Lead)
7. CompleteRegistrations
8. Schedules (+ Cost per Schedule)

This gives one glance at the full funnel from impression to booked
appointment, ordered the same way a visitor actually moves through it.

## 7. Pre-commit rung thresholds

Before activating spend, write down target ranges for each ladder rung so
performance is judged against a pre-committed bar, not vibes after the fact.
Fill in real numbers before go-live (use trailing benchmarks from the prior
campaign structure / industry comps where you don't have your own data yet):

| Rung | Target range | Notes |
|---|---|---|
| CPM | | |
| Link CTR | | |
| Cost / Landing Page View | | |
| Cost / ViewContent | | |
| Cost / Lead | | Primary optimization event |
| Lead → CompleteRegistration rate | | |
| Cost / Schedule | | Directional only until volume is real |

## 8. Activate Showcase

- [ ] Activate the Showcase campaign optimizing on `LEAD`
  (7-day-click / 1-day-view attribution window).
- [ ] Hand off ad sets — let them run **≥ 7 days** before any judgment or
  edit. Meta's learning phase needs the full window; touching an ad set
  mid-learning resets it.
- [ ] **Never add events mid-campaign.** If a new event (e.g. `Schedule`
  optimization) is wanted later, launch it as a **new** ad set, not a
  modification of a running one — mixing optimization events on a live ad
  set corrupts the learning phase and resets accumulated signal.

## 9. ~4 weeks out: optional Schedule probe

- [ ] Once Lead-optimized ad sets have ~4 weeks of stable data, optionally
  spin up a **separate** ad set optimizing on `Schedule` as an experiment.
- [ ] Expect it to be learning-limited (Schedule volume is much lower than
  Lead volume) — this is expected, not a failure signal on its own.
- [ ] Kill the probe if it loses to the Lead-optimized ad sets on Cost per
  Schedule / Cost per booked appointment after it exits learning. Don't let
  a learning-limited probe linger past a fair evaluation window.

## 10. First-party analytics reminder

Meta's dashboards only see what Meta can see. For the real picture — per-step
funnel drop-off, per-step dwell time, and true cost-per-appointment including
the **long tail past Meta's 7-day/1-day attribution window** — go to the
`leads` table (step timeline, per-step entries) plus the CRM (customers →
meetings), not Ads Manager. Meta undercounts delayed conversions; the
`leads` timeline and CRM pipeline are the source of truth for anything that
converts more than a week after the ad click.
