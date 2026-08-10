# Epic — Agent Dashboard Operational Home

**Branch:** `feat/281` (worktree `.worktrees/issue-281`) · **Issue:** #281
**Status (2026-08-10):** Plans 1, 1b, 2 **SHIPPED** (committed, unpushed). Plan 3 / #283 **SHIPPED in code** — status derived from `pipelineStage`, `status` column removed from schema; **the `DROP COLUMN` + `DROP TYPE` prod/dev push is user-gated and PENDING**. #282 (Action Queue) not started. Nothing pushed; no PR.

The `/dashboard` agent home was built (#281) with correct plumbing but a poor visual
surface **and** wrong data defaults. This epic sequences the remaining work into small,
independently shippable plans. First pass is **UI-centric**; data correctness follows.

## Confirmed defaults (from the 2026-08-06 requirements pass)

These are the operational definitions extracted with the user — the source of truth for
what each module shows. See [[feedback-data-defaults-from-lifecycle]].

| Module | Correct default | Notes |
|---|---|---|
| **Proposals** | **Two non-overlapping sections** (superseded the union — see `2026-08-08-dashboard-proposals-sections.md`): **Out for signature** = contract out (`contractSentAt` set AND `contractSignedAt`/`contractDeclinedAt` null) · **Sent — awaiting response** = `status = 'sent'` AND `contractSentAt` null | The section header names the state, so rows carry **no** per-row status badge. |
| **Projects** | **Two sections** (Active + On hold), status **derived from `pipelineStage`** via `PROJECT_STAGE_BUCKET`. Buckets: `active | completed | on_hold | cancelled`; **null ⇒ completed**. Pure-portfolio projects (no meetings) excluded. | `status` column **removed** from schema (#283; push pending). Records page still shows portfolio. |
| **Meetings** | Month calendar + day agenda (Plan 1b), meetings-only, excluding `cancelled` + `no_show` | Tabs replaced by a calendar; live-outcome filter folded into the month query. |
| **Needs attention (Action Queue)** | **Removed from the dashboard UI for now** — stub with wrong math/filters | Rebuild tracked in **#282**; `ActionCenterSheet` stays reachable from nav but stubbed. |
| **Snapshot strip** | Meetings today · Out for signature · Open projects | Drops the action-queue-derived "Follow-ups due" chip; no `getActionQueue` dependency. The proposals chip counts the Out-for-signature section (contract out). |

## Plans (execute in order)

### Plan 1 — UI redesign (Command Desk re-skin + A×C bento) · UI-centric
`2026-08-06-agent-dashboard-redesign.md` — **amended** to remove the Action Queue module,
swap the snapshot's third chip to Open projects, and drop `#queue` from the bento + the
`getActionQueue` prefetch. Everything else (fill-parent bento, cobalt, tinted depth, type
ramp, `DashboardModule` chrome, functional fixes on meetings/proposal/project cards) stands.
Data shown may still be wrong here — that is corrected in Plans 2–3. Ships the visual pass.

### Plan 1b — Meetings Calendar (UI)
`2026-08-06-meetings-calendar.md` — replaces the Meetings module's Today/Upcoming/Past tabs
with a compact month calendar (meeting-day dots, today preselected) + a selected-day agenda,
reusing the schedule feature's calendar primitive. Calendar-left/agenda-right on desktop,
stacked on mobile. Meetings only; view + quick actions (heavy scheduling stays on the schedule
page). **Folds in the meetings half of the data-correctness work** — the new month query (and
the snapshot's today query) exclude `cancelled`/`no_show` via `LIVE_MEETING_OUTCOMES`.

### Plan 2 — Dashboard data correctness: proposals (meetings folded into 1b)
`2026-08-08-dashboard-proposals-sections.md` — **supersedes** the original
`2026-08-06-agent-dashboard-data-correctness.md` (its "union" premise was wrong — the
`awaitingSignature` DAL filter is already contract-only). Replaces the single
Awaiting-signature module with two truthful sections — **Out for signature** (contract sent,
unsigned/undeclined) and **Sent — awaiting response** (proposal sent, no contract yet) — rather
than merging them into one union list. **The meetings task (exclude cancelled/no-show) moved
into Plan 1b**, so Plan 2 is proposals-only. No schema change.

### Plan 3 — Project status derivation + `status` column removal · **issue #283** — SHIPPED (code)
Codebase-wide refactor, tracked as **#283**. As shipped (2026-08-10):
- `PROJECT_STAGE_BUCKET` classifier + `deriveProjectStatusBucket` in `constants/enums/pipelines.ts` — buckets **`active | completed | on_hold | cancelled`** (final taxonomy: `got_full_payment` stays **active**; only `closed` ⇒ completed; **null ⇒ completed**). Mirrors `MEETING_OUTCOME_SENTIMENT`.
- Every `projects.status` reader repointed to the derived helper (customer-profile DAL, pipeline-items DAL, customer-pipelines router, dashboard, records filter).
- `crud.list` grouping consolidated to one derived **`statusBucket`** filter (`stagesForBuckets`); dashboard is now **two sections** (Active + On hold, `excludePortfolio`).
- **New this pass (not in original plan):** pure-portfolio projects (no meetings) are excluded from operational lists/analytics via `isPurePortfolioProject` / `hasAssociatedMeeting` + the `excludePortfolio` filter. The records page is the **only** surface that still shows them.
- `status` column + `project_status` pgEnum **removed from the schema**.

**PENDING — user-gated DB push** (dev + prod): `pnpm db:push` emits exactly `ALTER TABLE "projects" DROP COLUMN "status";` + `DROP TYPE "public"."project_status";` — no other column touched, no data loss beyond the removed column. The app runs correctly before the push (the extra column is ignored on read; inserts use its default).

## Spun-out issues

- **#282** — implement the real Action Queue ("Needs attention"). Removed from the UI in
  Plan 1; rebuilt under this issue. Also owns the `ActionCard` keyboard/name-drop/token defects.
- **#283** — derive project status from `pipelineStage`; remove the `status` column. This
  is Plan 3, tracked as its own issue (codebase-wide + schema migration).

## Sequencing & dependencies

Plan 1 → Plan 2 → Plan 3, sequential on this branch. No hard code dependency between them
(each touches different files), but shipping order is UI → proposals/meetings data →
projects refactor. Plan 3 is the only one with a schema migration; keep it last so the
branch's prod-push gate is a single, clearly-scoped step. #282 lands independently, after.

## Verification (all plans)

`pnpm tsc` + `pnpm lint` only (no test runner — never `pnpm build`), plus live browser
smoke (desktop 1440 + mobile 390; omni + agent roles). Execute each plan via
**superpowers:subagent-driven-development**. **Do not open the PR** — the user runs
`pnpm dispatch pr 281`.
