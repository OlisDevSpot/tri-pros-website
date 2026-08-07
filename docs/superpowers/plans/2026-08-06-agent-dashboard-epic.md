# Epic — Agent Dashboard Operational Home

**Branch:** `feat/281` (worktree `.worktrees/issue-281`) · **Issue:** #281
**Status:** Plan 1 (UI) shaped & planned; Plans 2–3 planned; #282 spun out.

The `/dashboard` agent home was built (#281) with correct plumbing but a poor visual
surface **and** wrong data defaults. This epic sequences the remaining work into small,
independently shippable plans. First pass is **UI-centric**; data correctness follows.

## Confirmed defaults (from the 2026-08-06 requirements pass)

These are the operational definitions extracted with the user — the source of truth for
what each module shows. See [[feedback-data-defaults-from-lifecycle]].

| Module | Correct default | Notes |
|---|---|---|
| **Awaiting signature** | **Union:** proposal `status = 'sent'` **OR** contract out (`contractSentAt` set AND `contractSignedAt`/`contractDeclinedAt` null) | Card must display the state that qualified the row, not a bare proposal-status badge. |
| **Open projects** | Derived project status `= active`, where status is **derived from `pipelineStage`**, not the `status` column | `status` column to be **eliminated**; null pipelineStage ⇒ sample ⇒ treat as closed. |
| **Meetings — Today / Upcoming** | Exclude `cancelled` + `no_show`; Past keeps all | Reuse the `outcome[]` filter with the live-outcome complement. |
| **Needs attention (Action Queue)** | **Removed from the dashboard UI for now** — stub with wrong math/filters | Rebuild tracked in **#282**; `ActionCenterSheet` stays reachable from nav but stubbed. |
| **Snapshot strip** | Meetings today · Awaiting signature · Open projects | Drops the action-queue-derived "Follow-ups due" chip; no `getActionQueue` dependency. |

## Plans (execute in order)

### Plan 1 — UI redesign (Command Desk re-skin + A×C bento) · UI-centric
`2026-08-06-agent-dashboard-redesign.md` — **amended** to remove the Action Queue module,
swap the snapshot's third chip to Open projects, and drop `#queue` from the bento + the
`getActionQueue` prefetch. Everything else (fill-parent bento, cobalt, tinted depth, type
ramp, `DashboardModule` chrome, functional fixes on meetings/proposal/project cards) stands.
Data shown may still be wrong here — that is corrected in Plans 2–3. Ships the visual pass.

### Plan 2 — Dashboard data correctness: proposals + meetings
`2026-08-06-agent-dashboard-data-correctness.md` — the explicitly-requested follow-up.
Redefines `awaitingSignature` to the union predicate and fixes the card's displayed state;
adds the live-outcome filter so Today/Upcoming exclude `cancelled`/`no_show`. No schema
change. Ships trustworthy meetings + proposals data.

### Plan 3 — Project status derivation + `status` column removal · **issue #283**
Codebase-wide refactor (its own concern, not just the dashboard), tracked as **#283**:
an entity-lib helper deriving `active/closed/cancelled/on_hold` from `pipelineStage`
(null ⇒ closed), repoint every `projects.status` call site to it, switch the dashboard
"Open projects" filter to derived-active, then drop the `status` column (schema migration;
**prod push is explicit/user-gated**). Ships correct projects data + cleanup. Full
bite-sized plan to be written when we reach it.

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
