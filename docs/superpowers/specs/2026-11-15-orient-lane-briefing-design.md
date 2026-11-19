# /orient lane briefing: design

> **Status**
> - Stage: spec · approved by the owner 2026-11-15 · amended 2026-11-16 after `/stress-test-plan` (decisions 9–12) and 2026-11-18 after a second pass (decisions 13–15) · plan `docs/superpowers/plans/2026-11-15-orient-lane-briefing.md`
> - Built on: — · Verified at: — · page: https://claude.ai/artifact/X83csYJwocEY4WcaY5TqWX (studies, pick B+)
> - Open: none
> - Blocked: none

## 1. Goal

The owner's words: `/orient` exists to **bridge** between the AI and the owner, "communicate it to me in the most effective way possible to allow me to give thorough and useful input". Today's page is "too verbose and hard to comprehend". The owner wants to see "what is currently being worked on + what is blocking what", and per feature "a more granular roadmap… a high level overview of what this feature ships, the decisions that have been made or need to be made, metadata", shown "in a way that isn't just text… blocker maps and other useful data vis… nodes are clickable, show data without moving to a new screen".

So `/orient` stops producing its own page. It writes a **briefing** into the feature's lane on the Parallel Ship Flow board (https://claude.ai/artifact/7D8kgccA7iy6f8ATWzLdqS), and the board's lane page (`#lane-<id>`) draws it: pictures first, details in a side panel, questions answered in place and read back by the agent.

## 2. Decisions already made

| # | Decision | Source |
|---|---|---|
| 1 | Direction **B+**: the briefing lives in the board's lane page; `/orient` writes data, the board draws it. No separate orient page. | owner, 2026-11-15 (studies page) |
| 2 | Pictures first: release map, blocker map, where the change lands, how long it has waited. Every node, bar, step, pin and point is clickable and opens its details in a side panel, never a new screen. | owner correction, 2026-11-15 |
| 3 | Every lane gets the blocker map, the change bars and the wait timeline. The **release map only for epics** (5 or more phases); smaller lanes get a phase strip. | owner, 2026-11-15 |
| 4 | Answers are given **on the page**, saved to the board, and read by the agent. No re-asking in chat by default. | owner, 2026-11-15 |
| 5 | Laptop first; iPad must work (side panel becomes a bottom sheet). | owner, 2026-11-15 |
| 6 | Status lives on the board; trackers keep rulings only. GitHub is the backlog, the board tracks what is active. | owner, decision `status-home`, 2026-11-14 |
| 7 | Live Vercel data on the page through the claude.ai connector (`list_deployments`); GitHub data waits until its connector is connected. | owner 2026-11-14; built in board v6 |
| 8 | Decision questions keep `/orient`'s four fixed categories and its "at most four" cap. | `.claude/skills/orient/SKILL.md` step 6 |
| 9 | The old `brief.open` lists (59 items on 13 lanes, 2026-11-16) are converted, not dropped: `owner: "you"` items become lane decision docs; `owner: "agent"` items go to `brief.agent`; the lane's `risk` goes to `brief.watch`; `brief.notes` moves to the lane's top-level `notes`. | owner, 2026-11-16 (stress test) |
| 10 | Rulings and the status block are written to the tracker copy **in the lane's worktree** (`brief.worktree`); a lane with no worktree uses the main checkout. This settles decision 6: trackers keep rulings and the status block (a fresh session's cold-start prompt); the board holds live status. | owner, 2026-11-16 (stress test) |
| 11 | Test fixtures are the board's real data, committed as-is. The repo is public; the owner accepts that the notes, paths and ids in them become public. | owner, 2026-11-16 (stress test) |
| 12 | One word per idea on the page and in the data: a question the owner answers is a **decision** ("Your decisions", pin and doc kind `decision`; mixed counts per decision 15); a to-do the owner ticks is an **owner check** (kind `check`); a risk the agent flags sits under **Watch out** (`brief.watch`). "Calls" is not used. | owner, 2026-11-16 (stress test) |
| 13 | The old `owner: "you"` items are sorted by Claude before the backfill: a real question becomes a decision, a to-do becomes an owner check, an item already settled by a later ruling or repeated on another lane is dropped. The owner approves the sorted list with the backfill go. | owner, 2026-11-18 (second stress pass) |
| 14 | The new board goes live right after the build, before the PR merges. Until the merge, the lane hook, `session-capture` and `/orient` runs use the new worktree's absolute paths (`/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/orient-lane-briefing/.claude/skills/…`); at ship they switch to the main checkout. | owner, 2026-11-18 (second stress pass) |
| 15 | Counts that mix decisions and owner checks say **"N waiting on you"** (Now row chip and lane header chip alike). "N decisions" is never used for a mixed count. | owner, 2026-11-18 (second stress pass) |

## 3. Content of a lane page (top to bottom)

All copy is plain language. IDs (DV3, R232, shas) appear only as small chips or inside the side panel, never as the lead of a sentence.

1. **Header**: back link · eyebrow `kind · branch · checked <date>` · name with phase IDs in muted text · `brief.goal` (one sentence: what changes for the people who use it) · three chips, each a button: `N waiting on you` (open decisions plus unticked owner checks; opens the first one), `N risks` (opens Watch out), `holds up N lanes` (selects the blocker map's first downstream lane). The existing "Edit stage, next step or dependencies" button and its form stay in the header.
2. **Where it stands**: epics get the **release map**: four steps (On prod · This release · Next · Later) from `brief.phases[].step`, titled by `brief.steps`, each with its phase chips and **pins** (a numbered pin per open decision whose `phase` is in the step, ✓ per open check, ! when `brief.watch` is not empty on the release step). Non-epics get the phase strip with its key. `brief.stand` (one or two sentences, first clause bold) sits under it.
3. **What it blocks**: the **blocker map** (§4.3).
4. **Where the change lands**: one bar per area from `brief.areas` (count, share of `brief.files`).
5. **How long it has waited**: the timeline from `brief.timeline`, with the **wait gap** from `brief.builtOn` to today labelled "N days built, not shipped" when the lane is past build and not shipped.
6. **Your decisions**: the lane's open decisions and owner checks as cards (question, why, options with their consequence, Claude's pick marked, a free-text answer, an optional note). A decision with no options (converted from an old list) shows only the free-text answer. Answered cards show the answer and the agent's reply, or "Answered · waiting for the agent". Changing an answer clears the reply and shows "waiting for the agent" again.
7. **The agent is handling** (`brief.agent`), **Already decided** (`brief.decided`, folded), **How the agent checked this** (`brief.evidence`, folded).
8. **Side panel** (right on laptop, bottom sheet under 860 px): shows live status by default (stage, whose move, PR, Vercel preview, session, next step, branch, tracker) and switches to whatever was tapped, with "Back to status".

The Data views lane on the studies page (section B+) is the reference rendering; its content is the real Data views data of 13 Nov.

## 4. Architecture

### 4.1 Where things live

| Piece | Lives in | Notes |
|---|---|---|
| Board page source | `.claude/skills/ship-board/page.html` in the repo (new), published to the board URL | Owner chose the repo, 2026-11-15. The scratchpad copy was lost when `/tmp` was wiped on 2026-11-15; a recovered copy sits in `~/claude-archive/2026-11-15-ship-board-source/`. |
| Board data | the artifact's `db` (collections `lanes`, `decisions`, `snapshots`, `setup`, `skills`, `flow_nodes`, `flow_changes`) | unchanged home |
| `/orient` | `.claude/skills/orient/SKILL.md`, `REFERENCE.md` | rewritten; `templates/` deleted |
| `session-capture` | `~/.claude/skills/session-capture/` (user level) | small addition (§4.6) |
| Lane link hook | `~/.claude/hooks/lane-context.sh` | one added instruction (§4.7) |

### 4.2 Page structure

One lane view renderer, `renderLaneView()`, built from small renderers: `laneHeader`, `whereItStands` (release map or phase strip), `blockerMapSvg`, `areaBars`, `waitTimeline`, `decisionsList`, `inspector`; the folded lists render inside `renderLaneView`. Selection state is one value, `S.sel = {t, id}` with `t ∈ status | lane | step | decision | check | watch | area | milestone | gap | more`. Every clickable element carries `data-sel="t:id"`; one delegated click handler sets `S.sel` and re-renders the inspector and the selected outline only. SVG nodes get `tabindex="0"`, `role="button"`, and Enter/Space activation.

The lane view re-renders when any of `lanes`, `decisions` or `snapshots/collisions` changes, whichever arrives first, and an unsent free-text answer or note survives the re-render. `lane-core.js` and `lane-view.js` load as classic scripts before the main script, so each is wrapped in an IIFE and exposes only `globalThis.LaneCore` or its named renderers (a top-level `function deps` would make the main script's `const deps` a SyntaxError and blank the board). `LaneCore` owns `deps`, `activeDeps` (deps that exist and are not shipped; parked ones count), `isLive`, `groupOf` and cycle detection; the page aliases them, so the Now tree and the blocker map cannot drift. One decision card renderer serves both the lane page and the Decisions tab, and keeps unsent drafts itself. Every class the lane view or the card adds starts with `lb-` (the board already uses `.dec`, `.opts`, `.todo`, `.st`, `.two`, `.lv` and `.lv-legend`); lane-view rules are scoped under `#lane-view`, card rules under `.lb-card` so the card is styled in the Decisions tab too. Changing lanes resets `S.sel`.

Layout: the lane view is a container (`container-type: inline-size`); `grid-template-columns: minmax(0,1fr) 320px` above 860 px, one column below, where the inspector becomes `position: sticky; bottom: 0` with `max-height: 42vh` and a top shadow. The three charts sit in `.viz` panels; "where the change lands" and "how long it has waited" share a row above 860 px.

### 4.3 Blocker map layout (no library)

Nodes are lanes; this lane sits in the middle column.

- **Columns**: `waits on` = `activeDeps(lane)` (stacked parent and `blockedBy`; a parked one drawn with a dashed border, so the map agrees with the Now tree's "blocked"); `this lane`; `waiting on it` = lanes whose deps include this lane; a fourth column = lanes whose deps include a column-3 lane. Edge style by relation: stacked (solid, accent, "built on"), waits (dashed, owner colour, "waits", tooltip = `blockReason`).
- **Overlaps row** below a dashed rule: lanes that share files with this lane in `snapshots/collisions` and are not already on the map. Red edge "N files conflict" when `conflicts > 0`, dotted "N shared, clean" otherwise.
- **Sizes**: node 150×52 (110 when its column is the fourth), column gap 70, row gap 36; a column holds at most 4 nodes, then a "+N more" node that opens the list in the side panel. The SVG viewBox is computed from the columns used; labels at ≥ 12 px rendered.
- An empty upstream column draws one dashed "no other lane" box. A dependency cycle is drawn once and flagged in the side panel ("these lanes wait on each other"), naming only the lanes in the loop, not lanes that merely wait on it.
- Columns 2 and 3 hold live lanes only (not shipped, not parked); parked lanes may appear in column 0 and in the overlaps row, with a dashed border.

### 4.4 Data the board reads (lane `brief`, written by `/orient`)

```
brief: {
  goal, stand,                         // plain sentences; stand's first clause is drawn bold
  phases: [{id, name, status, step}],  // status: shipped|built|building|decided|plan|spec|idea|parked
                                       // step: prod|release|next|later|parked
  steps: {prod, release, next, later}, // short titles, epics only
  areas: [{area, files, note}],        // ≤ 7 rows, last may be "other"
  files, aheadBehind, lastCommit, worktree, tracker, spec, plan,
  timeline: [{date, label, note}], builtOn,  // builtOn = start of "built, not shipped"
  watch: [string],                     // ≤ 3
  agent: [string],
  decided: [{date, text}],             // ≤ 6, newest first
  evidence: [string], verifiedAt       // "ref@sha date"
}
```

Required: `goal`, `phases`, and at least one of `tracker`, `plan`, `spec` (four lanes have no tracker today). A phase with no `step` is drawn in "This release". Everything else is optional and the page draws what exists. `lane-core.js`'s `validateBrief` and `validateDecision` are the schema; any prose copy points to them. Old-shape keys the backfill removes: `open` (converted, decision 9), `notes` (moved to the lane), `orientPage` (the board is the page now), `statusBlock` (the tracker holds it), `pr` (state and checks wait for the GitHub connector; the lane's `pr` number stays).

`briefAt` (date) sits beside `brief`. Everything else the page draws comes from fields that already exist: `stage`, `move`, `next`, `pr`, `port`, `neon`, `stackedOn`, `blockedBy`, `blockReason`, `session`, and the live Vercel watch.

### 4.5 `/orient` rewritten

Inputs and resolution stay as today. The workflow becomes:

1. **Resolve and confirm in one line**, then find the lane: `lanes` where `branch` equals the plan's `Built on`, else where `brief.tracker`, `brief.plan` or `brief.spec` equals the path. More than one match (two lanes share the trade-scenes tracker today): ask the owner which. A lane found without a `branch` gets it filled from `Built on`. No lane: create one (name from the tracker title, stage mapped from the status block: brainstorm→idea, spec→spec, plan→plan, building→build, built→review, shipped→shipped; `branch` from `Built on` or `null`, `move: "agent"`) and say so in the closing line.
2. **Apply answers first.** Read `decisions` where `lane == <id>` that have an `answer` or a `note` and no `appliedOn`. Write each as a dated ruling row in the owner's words into the first of: the tracker's rulings table, the plan's `## Rulings` table (the spec is never edited); with neither, the ruling lives only in the doc. The file is the copy in the lane's worktree (decision 10), or the main checkout when `brief.worktree` is missing or does not exist. Write into another session's worktree only when `git -C <worktree> diff --quiet -- <file>` is clean, and only the rulings table and status block; otherwise leave the file to the lane session and say so in `reply`. Then set `reply` (one or two plain sentences: what the agent will do, or the question it still has), `replyOn` and `appliedOn`. This is the step that makes answers reach the agent. A doc with no `lane` is applied by whichever session the owner asks, never by a lane run.
3. **Read** the allowed sources (unchanged).
4. **Run the three checks** (unchanged).
5. **Compute the pictures' data**: `areas` from `git diff --name-only <base>...<ref>`, where `<base>` is the `stackedOn` lane's branch for a stacked lane and `origin/main` otherwise, grouped as `src/<a>/<b>` (else the top folder), top six plus "other"; `timeline` from the tracker's ruling dates and status block; `builtOn` from the date the last task went `done`; collision pairs for this lane against every live lane with `git merge-tree --write-tree --name-only`, patched into `snapshots/collisions` with a fresh `asOf`.
6. **Write in one `ArtifactData` batch**: the lane's `brief` and `briefAt`, its `stage` and `next` when the checks changed them, and up to four decision docs plus any owner checks (§4.8). A question already open on the lane is updated, never added twice: doc ids are `<lane>-<slug>` (slug of the old item's `ref`, else of the question; letters, digits and `-` only; `-2`, `-3` on a clash), and open docs are compared by `ref` and by question text before writing. A pinned write that fails on a version is re-read and redone once. The status block in the lane's tracker copy gets `page: https://claude.ai/artifact/7D8kgccA7iy6f8ATWzLdqS#lane-<id>`.
7. **Close with one line and the link.** No `AskUserQuestion` by default. When the owner says to answer in chat, ask with `AskUserQuestion` and write the answers into the same decision docs, so the board stays the record.

**Dry mode** (`/orient <path> --dry`): runs steps 1–5 and writes the would-be brief, decision docs, ruling rows and decision patches to one JSON file in the session's scratchpad (or a path given after `--dry`); no board, tracker or memory writes.

Deleted: `templates/`, the visual-explainer render and publish steps, REFERENCE.md's "Pages" and "Decision sheet" sections (the four categories and the cap of four move into SKILL.md first). Kept: the checks, the status block, the speed discipline and the read-only rule toward app code. "Never DB writes" becomes "no app DB writes; board writes follow ship-board". The rule "no helper script lives in or beside this skill" gains one exception: `.claude/skills/ship-board/scripts/check-brief.mjs`, which only validates briefs and decision docs.

### 4.6 `session-capture` addition

At session end, only when the session works in the Tri Pros repo and the lane hook linked it to a lane: apply any answered decisions as `/orient` step 2 does (answers given while the session ran), then update the lane's `stage`, `next`, `session.lastSeen` and `brief.stand`, and write any question the session leaves for the owner as a lane decision doc instead of only in the tracker. It does not recompute areas, timeline or collisions; that stays with `/orient`. In any other project the skill is unchanged.

### 4.7 Lane hook addition

`lane-context.sh` adds one instruction: "Before other work, read `decisions` where `lane == <id>` that have an answer or note and no `appliedOn`; apply them by the rules in `<ship-board>/SKILL.md`." `<ship-board>` is an absolute path: the new worktree's copy until the PR merges, the main checkout's after (decision 14); lane worktrees don't carry the file until they merge main. Its existing step 3 reads `brief.tracker`, else `brief.plan` (the lane has no top-level `tracker` field).

### 4.8 Decision docs

Existing docs keep working (they carry `question`, `context`, `options`, `recommended`, `area`, `order`, `answer`, `answeredOn`, `note`). New fields:

```
lane: "<laneId>" | null,  phase: "<phase id>" | null,
kind: "decision" | "check",
options: [string | {label, consequence}],   // strings stay valid; [] = free text only
recommended: "<label>",
answer: "<label or free text>", answeredOn, own: true when free text, note,
done: true (owner checks),
askedBy: "orient" | "session" | "board" | "migrated", askedOn, ref: "<old open-item id>",
reply, replyOn, appliedOn
```

Saving or changing an answer writes `answer` and `answeredOn`, writes or clears `own` (cleared for an option) and `note` (cleared when empty), and clears `reply`, `replyOn` and `appliedOn` (`{"__delete__": true}`), so a changed answer reaches the agent again with no stale note. The card shows `context` and `area` as today's cards do. Dates are the viewer's local calendar day (`en-CA` format), not UTC. The page's db write carries no version pin, so a second answer replaces the first; the snapshot re-render shows whichever answer won.

The Decisions tab groups docs by lane (global ones first), uses the same card as the lane page, shows the owner's `note` and the agent's `reply` under each answer, marks answered-but-unapplied docs "waiting for the agent", and counts an owner check as open until `done` (in the tab badge and in "Yours" too). The Now view's lane rows get an `N waiting on you` chip (decision 15), redrawn when decisions change.

## 5. Data access

There is no app code, DAL, tRPC or schema change. The data changes are all in the board's own store, and Claude runs them, with no step for the owner first:

- **Reads used as-is**: `lanes`, `decisions`, `snapshots/collisions`, `setup`, the Vercel `list_deployments` watch.
- **Writes used as-is**: lane `stage/move/next/blockedBy/pr` from the edit form; decision `answer/answeredOn/note`.
- **New writes**: the page writes `answer`, `answeredOn`, `own`, `note`, `done` and clears `reply`/`replyOn`/`appliedOn` on decision docs (one write per change). `/orient` writes `brief`, `briefAt`, `reply`, `replyOn`, `appliedOn`, new decision docs, and collision pairs.
- **Backfill (once, by Claude)**, after a JSON backup of every lane, decision and the snapshot to `~/claude-archive/<run date>-board-backfill/`, and **after the new page is published** (the live v6 page cannot draw object options, `options: []` or briefs without `open`):
  - the 47 owner items are sorted (decision 13) and the owner approves the list; each kept item becomes a doc (`lane`, `kind` `decision` or `check`, `question` = the item's text, `ref` = its id or `null`, `options: []`, `askedBy: "migrated"`), id per §4.5 step 6; 12 agent items join `brief.agent`; 4 lanes' `risk` joins `brief.watch` and is deleted from the lane; `brief.notes` moves to the lane's `notes`; `decided` keeps its 6 newest rows (the tracker keeps them all);
  - the 13 existing lane briefs are rewritten into the §4.4 shape (add `stand`, `step`, `steps`, `areas`, `timeline`, `builtOn`, `watch`, `agent`);
  - the 11 existing decisions get `appliedOn: "2026-11-15"` where `replyOn` is on or after `answeredOn`; any other is left for the agent to apply.
  - The created doc ids are recorded with the backup. A re-run queries which exist and sends only the missing ones. Rollback: delete the created docs, pinned `set` of each lane and decision from the backup, republish the archived v6 page.
- **Not available yet**: GitHub PR checks and reviews (connector not connected on 2026-11-15). The panel shows the PR number and link only.

## 6. Error handling and edge cases

- **No brief**: the lane page draws the header, blocker map and decisions from existing fields, with an empty state in place of the other pictures: "No overview yet. Run /orient <tracker> to fill it."
- **No branch** (idea or spec lanes): no change bars and no wait gap; the panel says why.
- **Collision snapshot older than 3 days**: draw the overlaps row with an "as of <date>" label in the owner colour.
- **More than 4 nodes in a column**: "+N more" node; list in the panel.
- **Dependency cycle**: draw once, flag in the panel.
- **Read-only viewer or refused write**: options render disabled with "This view can't save answers"; a refused save shows the existing toast and keeps the card unanswered.
- **db unavailable or slow**: existing 10 s timer and loading copy; Vercel errors keep their per-code messages.
- **Unknown lane in the hash**: back link plus "No lane called <id>".
- **Long text**: names truncate inside SVG nodes with the full name in the panel; all text panels wrap.

## 7. Verification

- **Harness**: Playwright on a local copy of the page with a mock `db` (applies and records every `update`, fires `onSnapshot`, can deliver collections in any order) and a mock `mcp`, fed by the real lane and decision docs read with `ArtifactData`. Tests cover decisions arriving after lanes, and a typed draft surviving a lane snapshot.
- **Viewports**: 1280×800 and 1440×900 (laptop first), 820×1180 (iPad portrait), 390×844 (phone); light and dark.
- **Measured, not eyeballed**: no horizontal page overflow; blocker-map node boxes do not overlap and stay inside the viewBox; every `data-sel` kind opens its panel content; answering a decision issues exactly one `update` on the right doc with `answer` and `answeredOn`; the bottom sheet appears under 860 px; no console errors.
- **Lanes rendered**: Data views (epic, release map, stacked and waiting children, overlaps), R19 (6 phases, so an epic; PR and preview), pe4 (4 phases: phase strip), a lane with no brief, a parked lane, an unknown lane id.
- **After publish**: one functional pass: answer one real decision on the live page, then read it back once with `ArtifactData`.
- **`/orient`**: one `--dry` run on the Data views tracker, from a session started in the new worktree (a session elsewhere loads the old skill); check the written `brief` against §4.4, the would-be rulings, and that the lane page draws it; one live run on a plan with no lane (a lane is created), with the owner's go-ahead since it writes to the board.

## 8. Files

| Action | Path |
|---|---|
| Create | `.claude/skills/ship-board/page.html` (board source), `SKILL.md` (the URL, a pointer to the schema in `lane-core.js`, the vocabulary, the apply rules, how to republish), `lane-core.js`, `lane-view.js`, `scripts/check-brief.mjs`, `test/` (harness, unit tests, fixtures) |
| Modify | `.claude/skills/orient/SKILL.md`, `.claude/skills/orient/REFERENCE.md`, `CLAUDE.md` (the `/orient` line in "Planning": "a lean page, a decision sheet" becomes "a briefing on the lane's board page") |
| Delete | `.claude/skills/orient/templates/epic-page.src.html`, `templates/plan-page.src.html` |
| Modify (user level) | `~/.claude/skills/session-capture/SKILL.md`, `~/.claude/hooks/lane-context.sh` |
| Publish | the board artifact (same URL) with the new lane view |
| Data | the backfill in §5 |

Repo changes ship as one PR from a new worktree (`chore/orient-lane-briefing`), per the ship flow. Its last commit deletes this spec and its plan.

Added by the plan beyond this spec (accepted): options with consequences for the three Data views questions in the backfill; the memory update; `waitGap` counting only stages review, preview and ready; `merge-base --is-ancestor` for stacked pairs; the PR targeting `release/2026-11-13-drain` until #289 merges.

## 9. Out of scope and follow-ups

- **GitHub on the page** (PR checks, review state, Vercel toolbar threads) once the GitHub connector is connected.
- **Old orient pages** (5 artifacts: Office TV, Worktree → PR flow, Trade Scenes, Lot fences, Proposal Energy Impact) stay as they are; nothing links to them after the rewrite.
- **The Flow tab** and the eight proposed parallel-lane skills stay parked (owner: "after the plan").
- **Scheduled collision refresh** (a routine that recomputes the snapshot daily) is a follow-up; this spec refreshes it per `/orient` run.
