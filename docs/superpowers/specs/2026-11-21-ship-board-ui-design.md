# Ship board UI: design

> **Status**
> - Stage: spec · written 2026-11-21 · every choice ruled by the owner the same day (decisions 13–31) · approved by the owner 2026-11-21 · adjusted the same day for #296 (a lane outlives its first PR, §14)
> - Baseline: studies page https://claude.ai/artifact/2FEogNBKoCdV58gKcDmUGn (version 3; Study B, the epic map, picked 2026-11-21 with corrections; v7's lane page folded in). Source copy: `~/claude-archive/2026-11-21-ship-board-studies/ship-board-studies-v3.html` + `lane-core.js` + `v7data.js`.
> - Builds on: board v7 (live since 2026-11-21), source `.claude/skills/ship-board/` on main since #295.
> - Order (owner): ship the orient work (done, #295) → the dev-cycle epic tracker → the sync skill's design (decision 19) → this.
> - Open: none. Blocked: on the order above.

## 1. Goal

The owner's words (2026-11-21): the board must let him "orchestrate the orchestrators". He delegates work to agent teams, each run by one orchestrator, and his observability is this board. It must show, the way he ships, what each lane is doing, what is waiting on him and what is broken, and let him act from there. More and more of that happens on the iPad and the phone, where he often talks to a voice agent that reads and writes the board while he watches.

He also wants the GitHub issues model revived and "improved tremendously", with the data kept "in the place that is the easiest to keep in sync". Each epic has "its own rules, requirements and journey" that must stay visible while work happens inside it.

## 2. Decisions already made

| # | Decision | Source |
|---|---|---|
| 1 | GitHub issues (Project 3, "Tri Pros Development") are the record of all work. The board is where the owner orchestrates. | owner, 2026-11-21 |
| 2 | Three kinds of work: **epic** (an issue labelled `type:epic`; its plans are child issues), **standalone plan** (one issue), **bug** (an issue of type Bug, on the hotfix path). Areas are labels. | owner, 2026-11-21 |
| 3 | One worktree per plan. No alternative branches off a lane; a new idea gets its own worktree and lane. | owner, 2026-11-21 |
| 4 | The shared vocabulary (§3) and one home per fact (§4) are approved. | owner, 2026-11-21 |
| 5 | Direction **B, the epic map**, over A (inbox) and C (mission control). | owner, 2026-11-21 (studies page) |
| 6 | Corrections to B: an epic overview with its requirements, rules and journey; native filtering by kind (epics, standalone, bugs); search across epics, plans, bugs and lanes; collapsible epics; "nice UI/UX features". | owner, 2026-11-21 |
| 7 | Bring back v7's "blocked by / blocking" diagram (the blocker map). Use the studies page's main concepts and layout as the baseline. | owner, 2026-11-21 |
| 8 | Fold v7's per-lane findings (its lane page sections) into B's layout. | owner via the orient session, 2026-11-21 |
| 9 | Laptop proportions lead the layout; iPad and phone are designed too. R8.1 still holds for the phone's first screen. | owner, 2026-11-21 |
| 10 | Mocks use real data with stand-ins marked. | owner, 2026-11-21 |
| 11 | Scope split: this lane is what the board shows and does; what has to exist behind it becomes follow-up lanes (§12). | owner, 2026-11-21 |
| 13 | An epic is one parent lane: its own row, tracker and branch; each plan is a child lane whose branch and PR stack on the epic's branch; the epic reaches main in checkpoint merges (merge commits). | owner, requirement 1.4, 2026-11-21 |
| 14 | Requirements stay where they are: the dev cycle's in the board's `requirements` collection, every other epic's in its tracker's register. The epic overview reads them there; no `## Requirements` section in issues. | owner, 2026-11-21 |
| 15 | Choice 1: the epic overview's Journey lists the epic's plans; a lane page shows only that plan's own steps. | owner, 2026-11-21 |
| 16 | Choice 2: steps are named On prod · This release · Next · Later everywhere. | owner, 2026-11-21 |
| 17 | Choice 3: the board's written facts are kept in sync by a parallel-ship sync skill that runs as work happens and keeps GitHub issues and the board aligned, not by `/orient`. The skill is its own design (§12). | owner, 2026-11-21 |
| 18 | Choice 4: type-check collisions get their own red edge, "imports break", once the check exists. | owner, 2026-11-21 |
| 19 | The sync skill is designed right after the dev-cycle epic tracker and before this board's build; the other proposed parallel-lane skills keep the 15 Nov order (after Tasks 1–16). | owner, 2026-11-21 |
| 20 | Choice 5: file areas come from the PR's changed files when a PR exists, from the sync skill otherwise. | owner, 2026-11-21 |
| 21 | Choice 6: the Rules tab reads the epic tracker's rulings table live, next to its requirements. | owner, 2026-11-21 |
| 22 | Choice 7: blockers live on the lane row (`stackedOn`, `blockedBy`, `blockReason`), kept current by the sync skill; GitHub's "blocked by" links are not used. | owner, 2026-11-21 |
| 23 | Choice 8: a lane on the agent's move is "gone quiet" after 4 days with no commit, push, preview build or check-in. | owner, 2026-11-21 |
| 24 | Choice 9: **Start on issue** creates the lane row under its epic ("no orchestrator yet") and shows a copyable one-line command to start a worktree session on that issue; it starts no agent. | owner, 2026-11-21 |
| 25 | Choice 10: "gone quiet" is kept; "signal" is not used (the strip is the **status strip**, each count a **status filter**, words for the owner to confirm); "pull into flight" becomes **Start on issue**. | owner, 2026-11-21 |
| 26 | Choice 11: the orient session keeps the `ship-board-ui` row as its lane; this work gets a row keyed by its own issue once that issue exists. | owner, 2026-11-21 |
| 27 | A plan is done in two stages: "On prod" when its issue closes; "This release" when its PR merged into the epic branch. The epic's progress bar shows both. | owner, 2026-11-21 |
| 28 | In an epic's Journey, open plans with no lane go under Next when labelled P0 or P1, otherwise Later. | owner, 2026-11-21 |
| 29 | One lane carries one issue. Lanes that bundle items today split: each item gets its own issue and lane, stacked where one builds on another. | owner, 2026-11-21 |
| 30 | The tab bar stays with Now renamed Map; board-wide decisions show as one "Board · N waiting on you" row on the map and count in "waiting on you". | owner, 2026-11-21 |
| 31 | Work that touches only docs, scripts, skills or outside services gets no worktree: at most a branch off the main checkout. This spec, the board's source (`.claude/skills/ship-board/`, an artifact page) and its build follow that rule; "one worktree per plan" (decision 3) is for app code. | owner, 2026-11-21 |
| 12 | Kept from the orient design: "decision", "owner check", "Watch out", "N waiting on you"; decisions are their own docs keyed by lane; answers are given on the page and applied by the agent. | orient design decisions 4, 12, 15 |

## 3. Vocabulary (approved 2026-11-21)

| Word | Means |
|---|---|
| Epic | A GitHub issue labelled `type:epic`. Its child issues are its plans. It is also a lane (decision 13): its own row, branch, tracker and checkpoint PR. |
| Plan | A GitHub issue for one brainstormed piece of work, a child of an epic or standalone. Its spec and plan files sit in `docs/superpowers/`. |
| Bug | A GitHub issue of type Bug. Ships on the hotfix path. |
| Lane | One issue being worked on now: its own worktree, branch, draft PR and preview. An issue becomes a lane when the owner pulls it in. |
| Orchestrator | The one Claude Code session that runs a lane and its subagents. |
| Board | The Parallel Ship artifact, where the owner sees and steers lanes. |
| Tracker | An epic's file in `docs/plans/`: rulings, plus the status block a fresh session starts from. |
| Decision / owner check / "N waiting on you" | A question the owner answers; a thing only he verifies; the count of both. |
| Activity | A lane's timeline: commits, pushes, preview builds, PR events, orchestrator check-ins. |

New words (decision 25): **gone quiet**, **Start on issue**, **status strip** / **status filter** (to confirm).

## 4. Where each fact lives

| Fact | Its one home | Who writes it | The board reads it |
|---|---|---|---|
| What the work is: title, kind, area, epic → plan | GitHub issue (title, type/labels, parent) | owner or orchestrator | live, GitHub connector |
| Requirements | the dev cycle: board `requirements` collection; other epics: their tracker's register (decision 14) | owner or orchestrator | board db; tracker read live through the GitHub connector's file reader at the epic row's `brief.tracker` path |
| Done / still needed | child issues closed / open | GitHub, when a PR with `Closes #N` merges | live |
| PR, checks, changed files | GitHub | pushes | live |
| Preview, build state | Vercel | automatic | live, Vercel connector (as v7) |
| Commits per day | GitHub, the branch | pushes | live, for pushed branches |
| Stage, next step, whose move | lane row | orchestrator | board db |
| Orchestrator check-in | lane row `session` | the lane hook | board db |
| Stacked on / blocked by (with reason) | lane row `stackedOn`, `blockedBy`, `blockReason` | orchestrator | board db |
| Phases (with their step), watch-outs, agent's list, evidence, areas of unpushed branches | lane row `brief` | the sync skill (decision 17) | board db |
| Decisions and answers | `decisions` docs | orchestrator asks, owner answers on the page | board db |
| Collisions between lanes | `snapshots/collisions` | the sync skill | board db |
| Rulings (rules) | see §13 choice 6 | | |

Rules for reading and writing: a fact is read from its home, never from a copy. A fact is written in its home only; rows stop repeating what GitHub or Vercel know (title, PR number and state, labels). "Add a lane" means opening or picking the issue, then creating the row with the issue number.

## 5. Approaches

**What the board is (picked by the owner):** A inbox (a feed of what needs him, the work tree in a side column), **B epic map** (a status strip on top, then epics → plans → lanes), C mission control (a 14-day timeline per lane). B is the only one whose main structure is the agreed model; A's cards live on inside B's lane page and C's timeline inside each row's sparkline.

**How it is built (Claude's call, stated):**
1. **Evolve v7's plain HTML/JS** on a branch off the main checkout (decision 31) (`page.html`, `lane-core.js` pure and tested, `lane-view.js` renderers, the Playwright harness on a mock store). Chosen: the data schema, 28 unit tests, the harness and the blocker map already exist, and the studies mock already runs v7's `layoutBlockerMap` unchanged.
2. Rewrite in React from a CDN. Rejected: throws away the harness and tests for no gain the owner asked for.
3. The claude.ai Dashboard artifact type. Rejected: the board's interactions (answering decisions, the blocker map, the voice-agent writes) are custom.

## 6. Content and layout

The studies page, version 3, is the reference rendering for every screen below; where this section and the mock differ, this section wins.

### 6.1 The map (first screen)

Top to bottom:

1. **Top bar and tabs**: "Parallel Ship", a short status line ("epic map · N lanes in flight", hidden on the phone), and v7's tab bar with **Map** in place of Now: Map · Decisions · Merge · Flow · Setup · Reference. Decisions keeps v7's grouped list (board-wide first).
2. **Status strip**: five counts, each a **status filter**, each a toggle that dims every row it does not match. Tap again to clear.
   - **waiting on you**: lanes with an open decision, an unticked owner check, a merge-ready PR, or `move: you`; plus epics with an open decision.
   - **broken**: a preview build in error, or a PR whose checks fail. Zero reads as a plain all-clear line.
   - **ready to merge**: PR open, checks pass, no conflicts, preview ready.
   - **gone quiet**: the agent's move and no commit, push, preview build or check-in for 4 days or more (decision 23).
   - **collisions**: lane pairs with conflicting files in the snapshot, plus type-check collisions once that check exists (§12).
3. **Toolbar** (sticky under the top bar):
   - **Search**: matches epic names, plan names, issue numbers (`#291`), branch names and next steps. A match opens its epic, highlights the text, and an empty result says what search covers and offers Clear. `/` focuses it from anywhere on the page; Esc clears it.
   - **Kind switch**: All · Epics · Standalone · Bugs, each with its count.
   - **Collapse all / Expand all**.
4. **Epic blocks**, one per epic row (decision 13), in the order the owner sets (the epic row's `order`). Open `type:epic` issues with no row sit in the backlog. Each header: a fold chevron, the epic's name (opens the epic overview), `#issue epic`, area labels, "N waiting on you" when any, progress "done/total plans" with a bar (child issues closed of total), the epic branch's own preview and checkpoint PR chips when it has them, an Overview button. Folded, the header still shows one state dot per lane. Plan lanes inside it are `stackedOn` the epic's row, so the blocker map draws them as built on the epic. Folds persist per device in browser storage.
5. *(ruled: decision 20)*
6. *(ruled: decision 21)*
7. *(ruled: decision 22)*
8. *(ruled: decision 23)*

### 6.2 Epic overview

Opened from the epic's name or Overview. A wide side panel on laptop and iPad, a bottom sheet on the phone. Esc or Close returns to the map.

- Header: `epic · #issue · areas`, name, the goal line (the first paragraph of the epic issue's description).
- Summary: plans done (with bar), lanes in flight, waiting on you, open requirements.
- Tabs:
  - **Journey**: the epic's plans (child issues, in the epic's sub-issue order) in four steps (names: §13 choice 2), each linked to its lane when it has one:
    - **On prod**: the child issue is closed (its work reached main in a checkpoint merge or its own PR).
    - **This release**: open, and its PR merged into the epic branch, or its lane is in flight.
    - **Next**: open, no lane yet, labelled P0 or P1.
    - **Later**: open, no lane yet, P2, P3 or no priority label.
  - The progress bar counts **On prod** plans of all children; a second, lighter segment shows plans merged into the epic branch and not yet on prod.
  - **Requirements**: grouped, each item with its id, a status chip and its text, read where they live (decision 14): the board's `requirements` docs (`{id, title, items[{id, text, source, status}]}`) for the dev cycle; for other epics the tracker's requirements table, parsed by its `| ID | Requirement | … | Status |` rows (Trade scenes §3; statuses such as agreed, open, changed, absorbed shown as written). A count of open items heads the tab. A tracker that cannot be read (branch not pushed, connector off) shows its path and "open the tracker".
  - **Rules**: the epic's rulings, dated (home: §13 choice 6).
  - **Plans**: the epic's lanes with state and preview.

### 6.3 Lane page (v7 folded in)

Opened by tapping a lane row, a Journey item, or a blocker-map node. On laptop and iPad a wide panel over the map with "← Map"; on the phone a full sheet. Sections in order:

1. **Header**: `epic › kind · #issue · branch`, name, goal, chips (state, stage, PR, preview, orchestrator check-in, "N waiting on you" → jumps to the cards, "N watch out" → jumps to Watch out), Next.
2. **Waiting on you**: merge-ready PR card; v7's decision cards (options with consequences, Claude's pick, own answer, optional note, Save); owner checks with Mark done; answered cards folded under "Answered · N" with the agent's reply and "waiting for the agent to apply" until `appliedOn`.
3. **Where it stands**: v7's release map from `brief.phases` with numbered pins (decisions), ✓ (checks) and ! (watch). A pin jumps to its card. (Relation to the epic Journey: §13 choice 1.)
4. **What it blocks**: v7's blocker map, from `LaneCore.layoutBlockerMap` unchanged: columns waits on / this lane / waiting on it / then; edges built on, waits (with reason), files conflict, overlap clean; parked and "+N more" dashed; the overlaps row with "as of <date>" when the snapshot is stale. A node opens that lane's page.
5. **Activity · 14 days**: the sparkline at full width plus the wait line ("N days since the last commit, built and not shipped") when the lane is past build and not shipped.
6. **Where the change lands**: files per area (source: §13 choice 5).
7. Folded: **Watch out**, **The agent is handling**, **Already decided** (newest 6), **How the agent checked this**.

v7's inspector (tap a step, pin, node or bar to see its detail in a side panel) stays for the lane page's own details on laptop; on the phone details open inline.

### 6.4 Voice agent and live writes

When a row, card or epic changes because someone else wrote it (the voice agent, an orchestrator), the changed element flashes once (reduced motion: an outline instead). Nothing is written by the page except decision answers, owner checks, and the existing edit form.

### 6.5 Devices

- **Laptop (1280 and up)**: map with all columns; panels open at the right, 620 px (epic) and 780 px (lane).
- **iPad portrait (820)**: rows wrap chips to a second line; panels as on laptop, full width when narrower.
- **Phone (390)**: the first screen shows the status strip and the first epic without scrolling (R8.1); the status strip sits in one row of five; the kind switch fills the width; Collapse all, area labels and the Overview button hide (the epic name opens it); panels are sheets; the blocker map scrolls sideways at its natural size.
- Every action is a tap target of 32 px or more; keyboard shortcuts are extras.

## 7. Architecture

- **Pure logic in `lane-core.js`** (unit-tested, the one schema): `kindOf`, `stateOf` (parked, shipped, you, working, blocked, quiet, agent), `quietDays`, the five status-filter predicates, `readyToMerge`, `searchMatch`, `stepFor` (phase → step), requirement-table parsing from a tracker file (decision 14), and the existing `layoutBlockerMap`, `pinsByStep`, `waitGap`, `openCount`.
- **Renderers in `lane-view.js`**: map, epic block, row, status strip, toolbar, epic overview, lane page (reusing v7's decision card, release map and blocker map renderers).
- **State**: one object; filter, kind, search text, open panel and tab are page state; folds go to browser storage (try/catch).
- **Live data**: GitHub and Vercel through the `mcp` capability with `watchTool` (displays) as v7 does for Vercel. Failures per connector use v7's message table pattern (`VC_MSG`): the map still renders from board data, with a one-line notice of what is missing.
- **Joining data**: rows carry `issue`; the page fetches issues by number and PRs by head branch, and Vercel deployments by `meta.githubCommitRef`.

## 8. Data access

**Reads used as they are:** `lanes`, `decisions`, `snapshots/collisions`, `flow_changes`, `requirements` (board db); Vercel `list_deployments` (as v7).

**Writes used as they are:** decision `answer`, `answeredOn`, `own`, `note`, `done` and the clears (v7); the lane edit form.

**New reads (connector declaration, republish needed):** GitHub connector tools `issue_read` (get, get_sub_issues), `list_issues` (backlog, by label), `list_pull_requests` (by head), `pull_request_read` (get_check_runs, get_files), `list_commits` (branch activity), `get_file_contents` (tracker requirement registers). The manifest lists exactly these.

**Required changes, run before the dependent build tasks (each needs the owner's go):**
1. **Open the GitHub issues** for active work: one epic issue per epic (goal in its first paragraph, a link to its tracker) and child issues for its plans; issues for standalone plans and bugs. Outward writes on GitHub.
2. **Rows gain `issue`** (one number). One lane is one issue (decision 29): lanes that bundle items today split, so "Data views DV3 · DV3a · DV4" becomes three issues and three lanes (DV3a and DV4 stacked on DV3 where they build on it), "Filter rules FR4 · FR5" two, and "Worktree → PR flow, Tasks 1–16" one per plan the epic tracker names. Splitting a lane with commits on one branch is a git step the owner approves per lane. Epic rows carry the epic's issue. New rows are keyed `issue-<n>`; existing rows get `issue` added. Title, kind and PR number are read from GitHub; `name` and `pr` stay on old rows until the migration removes them.
3. **The lane hook finds a row by issue**: it parses the number from the branch name (`{type}/{issue}-{slug}`, already the branch rule in CLAUDE.md), falling back to branch match for branches without one. Fixes the shared-row collision of 2026-11-21 (two lanes on one branch).
4. **The sync skill exists** (decision 17, its own design): it writes `step` on each phase, `brief.areas` for unpushed branches, refreshes `snapshots/collisions`, and keeps rows and issues aligned as work happens. Until it ships, the board places phases by status (shipped → On prod; built, building → This release; decided, plan, spec → Next; idea, parked → Later) and shows the snapshot's date.
5. **Republish the board** with the GitHub connector declared alongside Vercel.

**Not available through connectors:** Project 3's Status column (no Projects tools) and GitHub's "blocked by" links (search is semantic). The board does not use either: stage and whose move live on the row; blockers live on the row (§4).

## 9. Requirements map (R0–R8)

| Item | Where it is met |
|---|---|
| 1.1 (open) | settled by 1.4; follow-up "git flow" lane updates the text |
| 1.2 | out of this lane (Neon copies); the row's `neon` field still shows on the lane page |
| 1.3 | blocker map conflict edges + collisions status filter; type-check collisions: follow-up lane |
| 1.4 | epic blocks with their plans; stackedOn edges |
| 2.1 | preview chip says "not pushed" when a lane in review has no draft PR |
| 2.2 (open) | follow-up lane "signed-in previews" |
| 2.3 | not the board's |
| 3.1 | status filters + ready to merge make a review sitting one screen |
| 3.2 | follow-up lane "preview notes reach the agent" |
| 3.3 | not the board's |
| 3.4 | "ready to merge" requires checks passing and a ready preview |
| 4.1 | the map; GitHub backlog folded under it |
| 4.2 | the status strip then the map; one tap opens a lane page |
| 4.3 | lane hook keyed by issue (§8.3); full self-updating rows: follow-up lane |
| 4.4 | GitHub + Vercel live (§8) |
| 5.1–5.3 | not the board's; 5.1 shows as a conflict with 1.4 in the dev-cycle epic |
| 6.1, 6.2 | the page writes nothing outward; connectors use the viewer's own grants |
| 6.3 (open) | follow-up lane "Doppler env" |
| 7.1 | wait line and "gone quiet" make built-not-shipped visible |
| 7.2 | `flow_changes` stays on its own tab |
| 7.3 | not the board's |
| 8.1 | §6.5 phone first screen; tap targets |
| 8.2 | preview chip on every row and lane page, branch address, age, build state |
| 8.3 | follow-up lane "signed-in previews" |
| 8.4 | follow-up lane "phone notifications" |
| 8.5 | board half: answers and notes on decision cards; preview half: follow-up |
| 8.6 | follow-up lane "iPad merge catch-up" |
| 8.7 | see working / waiting / idle and answer: here; start a lane from the phone: "Start on issue" + follow-up "always-on agents" |
| 8.8 | follow-up lane "always-on agents" |
| 8.9 | no secrets or bypass tokens in rows or links; preview links are Vercel branch addresses behind Vercel sign-in |

## 10. Error handling and edge cases

- A connector not connected, denied or failing: the map renders from board data; the affected chips show "—" with one notice naming the connector and how to connect it (v7's pattern).
- A row with no `issue`: it renders from its own `name`, marked "no issue yet" (old rows until migrated).
- An epic with no child issues: "no plans yet" instead of a bar.
- Two rows on one branch: allowed once rows are keyed by issue; the hook prefers the issue number.
- Collision snapshot older than a lane's last commit: "as of <date>" on the overlaps row (v7).
- Search with no match: the empty state with Clear; folds untouched.
- Read-only viewers: decision inputs disabled (v7); folds and search still work.
- Browser storage unavailable: folds reset each visit, nothing breaks.
- Rate limits: watches back off and show the age of the last data.

## 11. Verification

- `node --test '.claude/skills/ship-board/test/*.test.mjs'`: new pure functions, with real-data fixtures (v7 lanes and decisions; an issue body with a requirements table; a quiet lane; a merge-ready PR; a failing check).
- Harness states at 1280×800, 820×1180 and 390×844, light and dark: map, filtered by each status filter, each kind, a search hit and a miss, all folded, an epic overview on each tab, the Data views lane page. Each with `overflowPx: 0` (the blocker map scrolls inside its own box) and no console errors.
- Phone check: at 390×844 the status strip and the first epic header are inside the first screen.
- Live check after the republish: one read of the connector data on the real page, and the owner looks on the iPad and the phone (the only check that closes the build).

## 12. Out of scope, and the follow-up lanes

- **Phone notifications** (8.4).
- **Always-on agents**: lanes that keep going with the laptop closed, and starting a lane from the phone (8.7 rest, 8.8).
- **iPad merge catch-up and self-updating rows**: a reconcile after every merge, rows checked against git and GitHub (8.6, 4.3).
- **Signed-in previews**: stable preview addresses every vendor accepts, landing signed in (8.3, 2.2).
- **Preview notes reach the agent** (3.2, 8.5 preview half).
- **Type-check collisions**: a job that type-checks lane pairs and writes their result next to the git snapshot (1.3).
- **Git flow**: merge commits, slices, requirement 5.1 and 1.1 rewritten (untangle handoff plan A).
- **The sync skill** (decision 17): the parallel-ship skill that keeps GitHub issues and the board in sync as work happens; starts from the proposed `/lane-sync` and its siblings, with its own brainstorm and requirements. Several board fields depend on it (§8.4).
- **Doppler env** (6.3).
- The Flow, Setup, Merge and Reference tabs stay as they are.

## 13. Choices for you

All ruled on 2026-11-21 (decisions 14–26).

1. *(ruled: decision 15)*
2. *(ruled: decision 16)*
3. *(ruled: decision 17)*
4. *(ruled: decision 18)*
5. **Where the change lands** reads the PR's changed files live when a PR exists, and `brief.areas` from the sync skill otherwise.
6. **Rules' home.** Rules stay in the tracker with the requirements (consistent with decision 14), and the Rules tab reads the tracker's rulings table live, like the requirements. Alternative: the sync skill copies the newest into `brief.decided` (v7 today) and the tab shows those six.
7. **Blockers' home** stays the lane row (`stackedOn`, `blockedBy`, `blockReason`), not GitHub's "blocked by" links, which the connector cannot read.
8. **Gone quiet** after 2 days on the agent's move with no activity.
9. *(ruled: decision 24)*
10. *(ruled: decision 25)*
11. *(ruled: decision 26)*

## 14. Calls made while writing

Ruled by the owner on 2026-11-21 (decisions 13 and 27–30). Left as Claude's calls:

- "Type Bug" means the issue type Bug, which is enabled on the repo (Task / Bug / Feature); the `type:bug` label is kept alongside it until labels are reconciled.
- Folds persist per device in browser storage; nothing else is stored in the browser.
- A lane outlives its first PR (#296, owner ruling WF6): a lane that ships when it is good enough keeps its branch and worktree and opens a new PR later. So the page reads every PR on the lane's head branch: the PR chip shows the open PR, else the newest merged one, with "N shipped"; each merge is a tick on the activity timeline.
- Closing the issue: a lane that ships and keeps going writes `Refs #N` on its PRs; only the PR that finishes the lane writes `Closes #N`. A plan reaches On prod (decision 27) when its lane is finished, not at its first good-enough ship. **Owner to confirm.** The alternative is that each good-enough ship closes the issue and the follow-on work opens a new issue and row.
- A row's stage becomes `shipped` only when the lane is finished; a lane that merged a PR and keeps going stays in its working stage, and its merged PR shows on the chip.
