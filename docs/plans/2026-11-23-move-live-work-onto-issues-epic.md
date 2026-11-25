# Move live work onto GitHub issues — Epic Tracker

> **Status**
> - Stage: brainstorm · grilled 2026-11-24; `/to-spec #336` not run yet
> - Built on: `main` · Verified at: — · page: —
> - Done: bucket 0 docs half (`7a040c11d`); epic body contract EB1–EB8 (`160700426`); buckets 1 and 2 issues on GitHub (epics #354, #355)
> - Next: bucket 0 rest → `/to-spec #336` (from **Shaping outcome**) → buckets 1 and 2 tracker and memory moves → buckets 3–8
> - Open: bucket 0 has no issue yet (a #315 sub-issue that blocks bucket 1) · bucket owners for #345 and #222 (EB table)
> - Blocked: buckets 3–8 in parallel on #335

Issue: [#336](https://github.com/OlisDevSpot/tri-pros-website/issues/336). Its body is the contract (`docs/agents/issue-tracker.md`, Epic body); everything that changes lives here.

## Context

Re-verified 2026-11-24 against `main`.

- **The shape we migrate into:** ADR-0007 (`docs/adr/0007-plans-and-specs-stay-files.md`) and `docs/agents/issue-tracker.md` (Specs and trackers live in files; Epic body; Plan readiness). An epic or plan is an issue whose short body links to its committed spec and tracker; an epic's plans are its sub-issues; a plan's tasks live in its tracker, never as sub-issues; rulings are rows in the tracker's rulings table. This replaces the 2026-11-23 shape (spec in the body, rulings as comments, a `## Tracker` checklist in the body).
- **Shipped means proven:** a merged PR or a commit on `origin/main`. A doc saying "done" is not proof; docs here drift.
- **Reuse before create:** an existing issue that matches is rewritten, not duplicated. Priorities are copied or left for `/triage`, never invented.
- **Lanes mapped 2026-11-22:** #302–#313, #285 and #3 each carry a board row with `issue` (table under **Original request**). The #308 and #309 bundles are not split in git: one live plan file is one plan issue, and a lane may carry several (shaping Q3; board UI decision 29 retired).
- **Docs go straight to `main`** (WF16, 2026-11-24): no branch, worktree or PR, then `origin/main` is merged into every worktree. Issue forms count as docs (EB6).
- **How this epic runs** (owner 2026-11-23/24): shape the epic once as a whole (`/grill-with-docs` done 2026-11-24; `/to-spec #336` writes the spec under `docs/superpowers/specs/`); slice it (`/to-tickets`, each bucket a plan issue, rated; no lane opens on a `needs-info` plan); shape each plan under 8/10 against the spec; then the normal lane. The filter-rules test run (#309) is the first plan through.
- **Every GitHub and board write is dry-run first;** the owner says "apply".

## Shaping outcome (2026-11-24)

The `/grill-with-docs #336` session (transcript `3670293f`) finished at 17:38Z and recommended `/to-spec #336`, which never ran. Its recap is copied here so the spec has a source on `main`. These are the shaping session's words, not the owner's; `/to-spec` turns them into the spec.

1. **Shape** (Q3, Q4): an epic or a plan is a GitHub issue, and an epic's plans are its sub-issues; working detail stays in a committed tracker file. One live plan file is one plan issue; a lane can carry several plan issues. Epic body: what it solves, Done when, links. Plan body: a Step · Solves · Notes table from the tracker's task headings, plus the tracker link; no task sub-issues. Neither body carries status; rulings are linked, not copied. ~~A rewritten issue keeps its old body folded under "Original request".~~ Overridden for epics by EB1: the old body's live parts go to the tracker. Tracker rows with no plan file get no issue.
2. **Sources and links** (Q1, Q2): every copy of a file counts (`main`, lane branches, worktrees); the lane's branch is the base for its own files. Uncommitted docs are committed by their lane before anything links to them (trade-scenes' 61 files). An issue links to the file on `main` until its lane opens, then to the lane's branch, switched once at Open the lane.
3. **Nothing lost** (Q5): a file is deleted only when it has shipped (with proof), its leftovers have a home, nothing points at it, and no open lane has changed it. Every bucket's PR carries a per-file ledger of these checks with the last SHA. The owner sees a quick list before any bulk delete.
4. **Checks before review** (Q6): eight checks; one message per bucket, then the owner says "apply" and merges the bucket's docs change.
5. **Buckets** (Q7): table below. Run 0 → 1 → 2 in sequence, then 3–8 in parallel once #335 lands, and 9 last.
6. **Tooling** (Q8): `scripts/plan-migration/` holds `inventory` (read-only) and `apply` (`--apply`-gated, with a read-back), built during bucket 1 and deleted in bucket 9. #336 can't close while that folder exists on `origin/main`; #321 may take the drift-check idea, not the script.
7. **Agreed-but-unfiled steps** (Q10): each bucket reads only its own `memory/project-*.md` files. Nobody mines transcripts.
8. **Terms and ADR** (Q9): **Tracker** and **Ruling** in `GLOSSARY.md`, ADR-0007. Both on `main` (`25c09f814`).

## Buckets

Sizes are filename matches on `origin/main`'s 311 files (2026-11-24), not a verified inventory.

| # | Bucket | Size | Rating | Status |
|---|---|---|---|---|
| 0 | **The rules**: the reversal (below). A #315 sub-issue that blocks bucket 1 | ~8 files, ~15 issue writes | 9/10 | docs half done (`7a040c11d`); rest open; no issue yet |
| 1 | **Filter rules (#309)**: the test run | 3 files + branch copies | 9/10 | issues done 2026-11-25: epic #355, #364 FR0, #309 FR4 · FR5 (7/10, `needs-info`); tracker and memory moves open |
| 2 | **Data views (#308)**; one branch, one PR (#297), 24 docs files changed on the branch | ~28 | 8/10 | issues done 2026-11-25: epic #354, #308 DV3, #356–#363 (DV3a–DV11); tracker and memory moves open |
| 3 | **Meta ads, funnels, CAPI (#3)** | ~27 | 7/10 | waits on #335 |
| 4 | **UI and site**: theme, public site, media, PWA, analytics, R2, GoGreen, TV | ~46 | 6/10 | waits on #335 |
| 5 | **Proposal**: #305/#306, #307, calculators, energy impact, editor (#347) | ~49 | 6/10 | waits on #335 |
| 6 | **Meeting flow, home visit messages, VoIP (#313)** | ~49 + 3 `voip*` folders | 6/10 | waits on #335 |
| 7 | **Trade scenes (#302)**: ~14 on main + 61 uncommitted + `scene-layout-lab`'s 9 | ~84 | 5/10 | waits on the uncommitted docs being committed |
| 8 | **Backend**: tRPC, CASL #285, projects, construction #195, JSONB, layering, providers | ~65 | 5/10 | `issue-285` hasn't merged main |
| 9 | **Orphans and pointers**: unmatched files, open issues no bucket claimed, memory pointers; deletes `scripts/plan-migration/` | ~53 | 6/10 | last |

### Bucket 0: the reversal

Owner's list, 2026-11-24 (memory `project-dev-flow-rework.md`, "REVERSAL settled").

| Item | State |
|---|---|
| `docs/agents/issue-tracker.md`, `CLAUDE.md` stages 2–3, `docs/agents/triage-labels.md`, ship-board SKILL rule 2 | done, `7a040c11d` |
| PR #337 | closed, replaced by `7a040c11d` |
| ADR-0007 (PR #342) | on `main` as `25c09f814`; PR closed |
| Close #324, #325, #327–#334 as not planned (#323, #326 are done, leave them) | closed (checked 2026-11-24) |
| #316 back to `docs/superpowers/specs/2026-11-21-ship-board-ui-design.md` from its current body (git copy lacks ~12 KB, decisions 32–35); undo only amendments 13/14/21/22 + vocab/§4 rows | open |
| WF1–WF15 from the comments on #311 back into its plan's rulings table (WF8/WF14 edited since #317), and the plan's pointer line | open |
| R0–R8 from #315's body into a new dev-cycle tracker (e.g. `docs/plans/2026-11-24-dev-cycle-epic.md`); #315's body to the contract | open |

### Epics that break the body contract

Each is brought to the contract by the bucket that migrates it (EB7). Sizes in characters, 2026-11-24.

| Epic | Size | At fault | Bucket |
|---|---|---|---|
| #240 Codebase cleanup sweep | 18,669 | the whole audit (tiers, sequence, findings) in the body; no Done when | 8 |
| #222 SEO program master tracker | 15,769 | locked decisions, sequencing, KPIs, budget, status updates in the body; no Done when | 4 (proposed) |
| #336 this epic | 14,286 | Destination, context, gaps, restored handoff; no Done when | fixed with EB1 |
| #233 Customer → Contact rename | 11,477 | scope inventory, migration strategy, open questions in the body; Acceptance Criteria instead of Done when | 8 |
| #315 Dev cycle | 10,602 | Destination, "What we know so far", R0–R8 in the body; no Done when | 0 |
| #248 Provider boundaries | 6,208 | scorecard, progress, handoff in the body; no Done when | 8 |
| #256 Database standardization | 6,128 | done/remaining progress lists; no Done when | 8 |
| #345 In-app intake | 3,877 | old form: Destination, "What we know so far", Planned pieces, Open questions | 9 (proposed) |
| #3 Meta ads in-house | 2,679 | status, done/not done, how to resume; no Done when | 3 |
| #265 Funnel engine completion | 2,626 | workstreams, ordering, working rules; "Definition of done" | 3 |
| #302 3D trade scenes | 418 | short, but no Done when | 7 |
| #313 Home visit messages | 460 | short, but no Done when | 6 |

Already on the contract: #305, #347, #354, #355.

## Gaps in the dev cycle

This epic is the first run of the 12-stage flow. Each gap it hits goes here when it is hit; `/retro` turns them into guards or `chore` issues at the end.

1. `/to-tickets` from a file creates no parent: the epic had to be opened by hand first.
2. `/to-tickets` shapes once at the parent and labels every ticket `ready-for-agent`, but our flow shapes each plan against the epic first. Ruled 2026-11-23: each plan is rated; 8/10 or higher is `ready-for-agent`, below is `needs-info` (`docs/agents/issue-tracker.md`, Plan readiness).
3. The Epic issue form always applied `enhancement`; a `chore` epic was relabelled by hand. Fixed 2026-11-24 (EB5): the form applies `epic` only.
4. `/triage` reads and writes `.out-of-scope/`, which this repo doesn't have.
5. Parallel docs lanes needed their own checkouts; ruled bare worktrees 2026-11-23, replaced by WF16 (docs go straight to `main`) 2026-11-24.
6. The pre-commit gate blocks every commit from a checkout with no `node_modules`. Owner: that shouldn't be a rule in the gate; fix shaped in #335 under #315 (open).
7. The ship board sees none of this until a lane opens, and shows no blockers until the sync skill (#321) copies them.
8. Session scratchpads are wiped on reboot: the handoff this epic started from, and its lane-mapping file, were gone a day later. Restored from the session transcript; the lane mapping survives in each board row's `issue` field and under **Original request**.
9. Tracker copies drift between branches, and nothing says which one is current. On `main`, the filter-rules tracker had no rulings O15–O22 and said FR0 was "awaiting go"; on `feat/filter-rules`, FR0 was built. Lane branches change between 3 and 24 docs files each.
10. An idle lane can hold docs that exist only on disk. The `trade-scenes` worktree (no session since `2dda7dd88`, 2026-11-15) held 51 untracked and 17 modified files under `docs/`. No stage of the flow notices this.
11. A new shape went into the docs before anyone tried it on a real issue: "specs in the issue body" and "rulings as comments" were applied to #311, #315 and #316, then reversed the same day.
12. Two sessions settled the same question differently on the same day: the board UI session amended Ruling DC1 (tracker in the issue body, its own file paths) while the shaping session was writing ADR-0007, and #336's body was overwritten from a stale copy (body revision 17:56Z, reverted 17:57Z). Nothing tells a session that another one is mid-way through the same ruling. Memory `feedback-reread-live-before-shared-writes.md`.
13. An epic body with no contract grew without limit: #336 reached 14k with context, gaps and a restored handoff, because the Epic form asked for "What we know so far". Fixed 2026-11-24 by EB1–EB7.
14. Shaping results lived only in a transcript: the grill finished at 17:38Z with "run `/to-spec #336` next", and nothing on `main` or the board recorded that. Copied into **Shaping outcome** 2026-11-24.

## Rulings

| ID | Ruling | Date |
|---|---|---|
| EB1 | "What is happening in 336 must be avoided. An epic's issue body has defined groups of information, we don't braindump realizations there. For aspects of an epic that change regularly (realizations, context etc) we must keep separate from the epic issue body. An epic body should track the main focus of the epic, what it aims to solve or improve in our codebase, and other important aspects like 'what done looks like'." | 2026-11-24 |
| EB2 | Sections: the ADR-0007 minimum. A lead paragraph on what it solves, `## Done when`, `## Links`; no Focus or Destination heading. | 2026-11-24 |
| EB3 | `## Out of scope` goes in the body, optional, between Done when and Links. | 2026-11-24 |
| EB4 | Comments on an epic are milestone pointers only: a short dated note linking the commit or tracker section; the content is written in the tracker. #336's three comments are copied into this tracker's log and stay as history. | 2026-11-24 |
| EB5 | The Epic form applies `epic` only; the category is added by hand. | 2026-11-24 |
| EB6 | Issue forms under `.github/ISSUE_TEMPLATE/` count as docs under WF16: straight to `main`. | 2026-11-24 |
| EB7 | Guard: the written rule and the form, with a soft limit of about 2,000 characters in the rule. A CI check only if it happens again. | 2026-11-24 |
| EB8 | The restored 2026-11-22 handoff: its live parts (the "Not done yet" list and steps 1–5) go into this tracker; the superseded sections are dropped, and #336's edit history keeps the full text. | 2026-11-24 |

## Log

- **2026-11-23** #336 opened from the 2026-11-22 handoff; gaps 1–8 found before slicing.
- **2026-11-24 05:52Z** Gaps 9–11 found while shaping ([comment](https://github.com/OlisDevSpot/tri-pros-website/issues/336#issuecomment-7123355048)).
- **2026-11-24 06:07Z** From the board UI plan (#316 tracker tasks 2 and 3), owner's go: board row `issue-315` created; #305 blocked by #308 on GitHub; #307 (PE4) a sub-issue of #305 (#303 was already under #302). Handed to this epic: issues for the two live rows that have none, `foundation` (PR #292) and `scene-lab` ([comment](https://github.com/OlisDevSpot/tri-pros-website/issues/336#issuecomment-7123608671)). The #308/#309 split it also handed over was retired by shaping Q3, and Ruling DC1's in-body checklist by ADR-0007.
- **2026-11-24 17:38Z** Shaping finished (see **Shaping outcome**); ADR-0007 and the glossary terms landed on `main` (`25c09f814`).
- **2026-11-24 18:34Z** Bucket 0 docs half done, `7a040c11d` ([comment](https://github.com/OlisDevSpot/tri-pros-website/issues/336#issuecomment-7140826441)). `origin/main` merged into 7 lane worktrees; `issue-285` conflicted (aborted, clean); `scene-layout-lab` and `trade-scenes` refused (uncommitted local edits).
- **2026-11-24** Epic body contract (EB1–EB8, `160700426`): rule in `docs/agents/issue-tracker.md`, pointer in `CLAUDE.md` stage 1, Epic form rewritten, this tracker created, #336's body brought to the contract (14,286 → 1,732 characters).
- **2026-11-25** Buckets 1 and 2 on GitHub, owner's go, from the data-view orchestrator session ([comment](https://github.com/OlisDevSpot/tri-pros-website/issues/336#issuecomment-7175755410)). Epic #354 Data views: #308 rewritten to DV3; #356 DV3a and #357 DV4 (closed by PR #297 with #308); #358 DV5, #359 DV6, #360 DV8, #361 DV9, #362 DV10, #363 DV11 as `needs-info` with ratings (owner: every DVx is a sub-issue). Epic #355 Data-view filter rules: #364 FR0; #309 rewritten to FR4 · FR5, 7/10 → `needs-info` (its plan is a month older than main). Blocked by: #309, #358, #359, #360 ← #308; #361 ← #360; #362 ← #359; #305 ← #308 unchanged. Bodies follow the epic body contract and the plan body shape; links point at the lane branches. #43, #153 and #110 overlap DV9 / #354: commented, left for `/triage`. Still open for both buckets: the tracker and memory moves.

## Original request: the 2026-11-22 handoff (live parts)

Kept under EB8. Where it conflicts with ADR-0007, WF16 or **Shaping outcome**, those win.

**Goal.** GitHub issues are the record of all work. Move every piece of live work onto them: board lanes, epic trackers in `docs/plans/`, pending specs and plans in `docs/superpowers/`, and action steps agreed in recent sessions that were never written down.

**Lanes reconciled 2026-11-22:**

| Issue | Board lane | What it is |
|---|---|---|
| #302 | trade-scenes | epic; #303 release 3 (PR #291) and #304 heating & cooling are its sub-issues |
| #305 | proposal-page | epic; #306 page (PR #298) is its sub-issue |
| #307 | pe4 | |
| #308 | data-views | PR #297 |
| #309 | filter-rules | |
| #310 | office-tv | |
| #311 | dev-flow | |
| #312 | confidence-scorer | |
| #313 | hv | epic |
| #285 | casl-285 | |
| #3 | meta-ads | epic |

**Not done yet (2026-11-22):**
- Splitting bundled lanes (#308: DV3, DV3a, DV4; #309: FR4, FR5). Retired by shaping Q3: each plan file gets its own plan issue, and the branch is not split.
- Epic trackers and pending specs and plans with no issue.
- The 143 open issues (124 `needs-triage`): many predate the migration and may duplicate, or already cover, work found in files.
- Board lanes still without `issue`: drain, foundation, google-preview-signin, r19, scene-lab, ship-board-ui, superseded. Each is shipped, superseded or still live; the inventory decides which.

**Steps (2026-11-22), now run per bucket:**

1. **Explore**, read-only, returning rows of `source · kind (epic | plan | spec | lane | action) · title · parent epic · state (shipped | live | parked | superseded | unclear) · open items · matching issue # · evidence (SHA, PR, file:line)`. State must be backed by evidence. The board is read with `ArtifactData`. Done when every file in scope and every lane has a state and every open issue is grouped or flagged.
2. **Build the migration map**: one row per future issue, `key · parent key · title · labels · status (only if claimed) · reuse #N or new · body source · lane id · branch`. Reuse an existing issue whenever one matches; never invent a priority. List separately the files to delete, the issues to close (with evidence), and the lanes affected. Done when every live item is a row or written down as deliberately excluded, with the reason.
3. **Show the owner and get the rulings**: conflicts, counts by group (epics, plans, reused, new, closes, deletes) and the full map. Done when the owner has approved the map group by group.
4. **Dry run, then apply**: a script that does nothing without `--apply` (now `scripts/plan-migration/apply`, shaping Q8): create or rewrite issues → sub-issue links (database id, `-F`) → blocking links (real numbers, second pass) → Project 3 Status for claimed work only → board rows' `issue` field pinned with `if_version`. Done when a read-back matches the map.
5. **Docs, memory**: delete the approved spec and plan files and fix tracker links and `CLAUDE.md` pointers (straight to `main`, WF16); update the migration-state line in `memory/reference-github-workflow.md` and `MEMORY.md` entries pointing at deleted files.
