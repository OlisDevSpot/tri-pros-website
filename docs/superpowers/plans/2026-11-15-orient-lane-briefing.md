# /orient lane briefing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/orient` writes a briefing into the feature's lane on the Parallel Ship Flow board, and the board's lane page draws it as pictures (release map, blocker map, change bars, wait timeline) with a click-to-inspect side panel and on-page answers the agent applies.

**Architecture:** The board's source moves into the repo as a skill folder (`.claude/skills/ship-board/`): `page.html` (markup, styles, app shell), `lane-core.js` (pure functions and the data schema, unit-tested with `node --test`) and `lane-view.js` (DOM renderers, checked by a Playwright harness on a mock store). It is published as one artifact with the two scripts as supporting files. `/orient` and `session-capture` change from page builders to writers of the board's `lanes` and `decisions` docs.

**Tech Stack:** Plain HTML/CSS/JS (no framework, no library), Node 24 `node:test`, Playwright, the Artifact and ArtifactData tools, git.

**Spec:** `docs/superpowers/specs/2026-11-15-orient-lane-briefing-design.md` (amended 2026-11-16, decisions 9–12, and 2026-11-18, decisions 13–15)

## Global Constraints

- Board URL `https://claude.ai/artifact/7D8kgccA7iy6f8ATWzLdqS`; always republish to it with `url` set (read it first in a new session); omit `capabilities` so `{db, user, mcp: Vercel list_deployments}` carries forward. The live version is v6 (last updated 2026-11-14), the same as `~/claude-archive/2026-11-15-ship-board-source/parallel-ship-flow.published-v6.html`.
- Work in a new worktree `.worktrees/orient-lane-briefing`, branch `chore/orient-lane-briefing` cut from `release/2026-11-13-drain` (`/orient` exists only there and on local main until PR #289 merges). The PR targets `release/2026-11-13-drain`. Every session that runs the new `/orient` (Task 5, Task 7) starts in that worktree; a session started elsewhere loads the old skill.
- Commit by explicit path only: `git add -- <paths> && git commit -m "…" -- <paths>` (a commit pathspec alone refuses new files). No stash, reset, checkout of paths, `git add -A/./-u`. The repo's Claude pre-commit hook type-checks the main checkout (~110 s): batch each task into one commit. After any scripted edit, `git diff --shortstat` to catch CRLF churn (all target files are LF today).
- Never `pnpm build`, never start a dev server, no app code under `src/` changes. `pnpm install --frozen-lockfile` once in the new worktree (a plain `git worktree add` has no `node_modules`); `pnpm lint && pnpm tsc` before the PR.
- Tests: `node --test '.claude/skills/ship-board/test/*.test.mjs'` (a folder argument fails on Node 24, and the glob keeps `harness.mjs` and `*.checks.mjs` out). Harness: `node .claude/skills/ship-board/test/harness.mjs …`; every relative path it takes resolves against `.claude/skills/ship-board/`.
- Board writes happen only in Task 7 (publish, backfill) and in Task 7's one live `/orient` run, each after the owner says go. Every test runs on fixtures and the mock store.
- Vocabulary (spec decisions 12 and 15): **decision** (question the owner answers; doc kind, pin kind, `data-sel` kind, copy "Your decisions"), **owner check** (kind `check`), **Watch out** (`brief.watch`), **"N waiting on you"** for any count that mixes decisions and checks. Never "call" or "calls" in code or the page's own copy.
- No committed file cites the spec or plan: no "decision N", "§", "page:N", "Task N" or "Review focus N" in code, tests, test names or SKILL.md. Before the PR: `grep -rnE "decision [0-9]|§|page:[0-9]|[Rr]eview focus|Task [0-9]" .claude/skills/ship-board .claude/skills/orient` → no hits.
- `lane-core.js` and `lane-view.js` are each wrapped in an IIFE. `lane-core.js` assigns only `globalThis.LaneCore = {…}`; `lane-view.js` assigns only the named renderers on `window`. Same file runs as a classic `<script>` and under `node --test` via `import "../lane-core.js"` (the repo is `"type": "module"`).
- Every class the lane view or the decision card adds starts with `lb-` (the board already uses `.dec`, `.opts`, `.todo`, `.st`, `.two`, `.lv`, `.lv-legend`). Lane-view rules are scoped under `#lane-view`; card rules under `.lb-card`, so the card is styled in the Decisions tab too.
- `lane-core.js` is the one schema: `validateBrief` and `validateDecision` check every field `lane-view.js` reads. `ship-board/SKILL.md` and memory point to them; they never copy the field list.
- Dates written by the page or by Claude are the local calendar day: `LaneCore.localDay(date)` builds `YYYY-MM-DD` from `getFullYear/getMonth/getDate`; the page's `today()` becomes `() => LaneCore.localDay(new Date())`.
- Pinned values: epic = `brief.phases.length >= 5` (R19 with 6 phases is an epic; pe4 with 4 is not); blocker map node 150×52, fourth column 110×52, column gap 70, row gap 36, max 4 nodes per column then a "+N more" node; collision snapshot stale after 3 days; side panel 320 px wide; one column below an 860 px container width, panel becomes a bottom sheet with `max-height: 42vh`; labels in SVG ≥ 12 px rendered; `decided` ≤ 6, `watch` ≤ 3, `areas` ≤ 7.
- Copy is plain language; IDs only as chips or inside the panel; the Data views lane in the studies page (https://claude.ai/artifact/X83csYJwocEY4WcaY5TqWX, section B+) is the reference rendering.
- Fixtures are the board's real data, committed as-is (owner accepted, the repo is public).
- Every `ArtifactData` write to an existing doc carries `if_version`; a batch holds at most 50 writes and never names a doc twice.
- Until this PR merges, the lane hook, `session-capture` and `/orient` reach ship-board by the absolute path `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/orient-lane-briefing/.claude/skills/ship-board/`; at ship they switch to the main checkout.

## Review Focus

1. A lane whose `brief` has the old shape (`open`, `notes`, `orientPage`, `pr`, `statusBlock`; no `step`, `steps`, `areas`, `timeline`, `builtOn`, `stand`; `tracker: null`), a lane with no `brief` at all, and an unknown lane id: the lane page renders from what exists, shows the empty state or "No lane called <id>", no console error (Task 3).
2. A decision doc with legacy string `options`, `context` and `area`, no `lane`, and a migrated doc with `options: []`: the Decisions tab and the lane page show it, its note and reply, and answering saves (Task 4).
3. A lane whose deps name a shipped, parked or unknown lane, or a loop with a lane waiting on it: the blocker map drops the shipped and unknown ones, draws the parked one dashed (as Now says "blocked"), and names only the loop's lanes (Task 2).
4. Data arriving in any order (decisions after lanes, collisions last) and a lane or decisions snapshot landing while the owner types: the lane view and the Now chips fill in when each arrives and the typed draft survives (Tasks 3–4).
5. The owner changes an answer the agent already applied (from free text with a note to an option with none), or the save is refused, or the viewer is read-only: `reply`/`replyOn`/`appliedOn`, `own` and `note` are cleared; a refused save shows the toast and leaves the card unanswered; a read-only view disables the inputs (Task 4).

---

### Task 0: Worktree, board source in the repo, fixtures, harness baseline

**Files:**
- Create: `.claude/skills/ship-board/page.html` (from the v6 archive file, publish skeleton stripped: drop line 1, everything before `<title>`, and the closing `</body></html>`; the archive's line numbers cited below shift by −1)
- Create: `.claude/skills/ship-board/SKILL.md`
- Create: `.claude/skills/ship-board/test/fixtures/{lanes,decisions,snapshots}/*.json` (pulled), `test/fixtures/vercel.json`, `test/fixtures/extra/` (hand-written, Step 3)
- Create: `.claude/skills/ship-board/test/fixtures.mjs`, `test/harness.mjs`, `test/baseline/*.txt`, `test/.gitignore` (`shots/`)
- Move into the worktree and commit: the spec and this plan (delete the untracked copies in the main checkout after the commit)

**Interfaces:**
- Produces `test/fixtures.mjs`: `loadLanes(dir?) -> lane[]`, `loadDecisions(dir?) -> decision[]`, `loadSnapshot() -> object` (each doc gets `id` from its filename when absent; `extra/` files are merged in, overriding same-id docs).
- Produces `node .claude/skills/ship-board/test/harness.mjs [hash…] [--viewport=WxH] [--scheme=light|dark] [--brief=<laneId>=<file>] [--order=lanes,decisions,collisions] [--delay=<collection>=<ms>] [--reject-next[=code]] [--read-only] [--script=<file.mjs>]` → screenshots to `test/shots/`, and one JSON line per page state: `{hash, viewport, scheme, overflowPx, consoleErrors:[], updates:[{path, patch}], checks:{…}}`. `checks.nowGroups` is `{laneId: group}` read from the Now tree; `checks.text` maps each tab (`now`, `decisions`, `reference`) to its `innerText`.
- The harness serves the skill folder on a fake origin with `page.route("https://board.test/**")` and opens `https://board.test/index.html`, a wrapper of `page.html` with `[hidden]{display:none!important}` (so `<script src="lane-core.js">` resolves). `--brief` accepts a brief or `{brief, decisions}` (unwrapped).
- The mock store applies every `doc(path).update(patch)` (including `{"__delete__": true}` at any depth), records it in `window.__updates`, and fires the matching `onSnapshot` listeners; `--order` sets the order (100 ms apart) in which collections first arrive; `--delay` holds one back; `--reject-next` makes the next update reject with `{code}` (default `unavailable`; `invalid_argument` triggers the page's read-only switch); `--read-only` makes `user.can("data.write")` resolve `false`. The mock `mcp.watchTool` replays `vercel.json`. `--script` runs page actions (click, type, key, wait) and returns extra `checks`.

- [ ] **Step 1:** `git worktree add .worktrees/orient-lane-briefing -b chore/orient-lane-briefing release/2026-11-13-drain`, then `pnpm install --frozen-lockfile` inside it; work only inside it from here on.
- [ ] **Step 2:** Pull fixtures with `ArtifactData` `list` and `out_dir` set to `.claude/skills/ship-board/test/fixtures` for `lanes` and `decisions`, and `get` for `snapshots/collisions`. Write `vercel.json` with the verified payload shape `{result:{deployments:[{url, state, created, target, meta:{githubCommitRef, githubCommitSha}, inspectorUrl}]}}` for two branches and one production deploy.
- [ ] **Step 3:** Hand-write `test/fixtures/extra/`:
  - `decisions/data-views-*.json`: three Data views decisions in the spec §4.8 shape (`lane: "data-views"`, `phase` DV4/DV4/DV10, object options with consequences, `recommended`, `context`, `area`), one already answered with a free-text answer (`own: true`), a `note`, `reply`, `replyOn` and `appliedOn`, plus one owner check (`kind: "check"`, `phase: "DV4"`);
  - `decisions/casl-285-db1.json`: a migrated doc (`options: []`, `askedBy: "migrated"`, `ref: "DB1"`);
  - `lanes/long-names.json`: a live lane with a 90-character name, `blockedBy: ["data-views"]`, and a 300-character `next`.
- [ ] **Step 4:** Write `SKILL.md`:
  - frontmatter `name: ship-board`, description "Use when updating or republishing the Parallel Ship Flow board, reading or writing its lanes and decisions, or applying the owner's answers";
  - the URL;
  - the schema: a pointer to `validateBrief` and `validateDecision` in `lane-core.js` and to `scripts/check-brief.mjs`, never a copy of the fields;
  - the vocabulary;
  - **how to apply answers** (the one home of these rules; `/orient`, the hook and `session-capture` point here): which docs (lane matches, `answer` or `note`, no `appliedOn`; lane-less docs only when the owner asks); the ruling target (tracker's rulings table, else the plan's `## Rulings`, else the doc alone; never the spec); which copy (the lane's worktree, or the main checkout when `brief.worktree` is missing or gone); the guard (`git -C <worktree> diff --quiet -- <file>` clean, else leave it to the lane session and say so in `reply`); then `reply`, `replyOn`, `appliedOn`;
  - how to republish (`Artifact` publish `file_path: page.html`, `url`, `files: {"lane-core.js": "…", "lane-view.js": "…"}`);
  - the rollback (delete created docs, pinned `set` from the backup, republish the archived v6 page);
  - the test commands from Global Constraints.
- [ ] **Step 5:** Write `fixtures.mjs` and `harness.mjs` per the interfaces above.
- [ ] **Step 6:** Baseline: run the harness on `now`, `decisions`, `reference` and `lane-data-views` → `overflowPx: 0`, `consoleErrors: []`; repeat with `--order=decisions,lanes,collisions` → same. Save `checks.nowGroups` and `checks.text` to `test/baseline/` (`now-groups.json`, `now.txt`, `decisions.txt`, `reference.txt`).
- [ ] **Step 7:** Commit `.claude/skills/ship-board/` and the two docs: `chore(ship-board): board source, fixtures and harness in the repo`.

### Task 1: `lane-core.js` pure functions and schema

**Files:**
- Create: `.claude/skills/ship-board/lane-core.js`, `test/fixtures/brief-data-views.json`
- Modify: `.claude/skills/ship-board/page.html` (load `lane-core.js`; replace the page's `deps`, `live`, `groupOf` and `today` with aliases to `LaneCore`; `relText` uses `activeDeps`; `order()` flags only the lanes `LaneCore.findCycle` returns)
- Test: `.claude/skills/ship-board/test/lane-core.test.mjs`

**Interfaces:**
- Produces, on `globalThis.LaneCore`:
  - `deps(lane) -> string[]` (`[stackedOn, ...blockedBy]`, unique, falsy dropped; archive line 478), `activeDeps(lane, laneMap) -> string[]` (deps present in the map and not shipped; parked ones count), `isLive(lane)` (not shipped, not parked; archive line 479 `live`), `groupOf(lane, laneMap)` (archive line 480, written with `activeDeps`, same behaviour)
  - `findCycle(lanes) -> string[]`: ids of live lanes that sit on a dependency loop (strongly connected components of size > 1, or a self-loop); a lane that only waits on a loop is not in it; `[]` when none
  - `localDay(date) -> "YYYY-MM-DD"` (local calendar day)
  - `isEpic(brief) -> boolean`
  - `normalizeOptions(options) -> {label, consequence}[]` (strings become `{label, consequence: ""}`; `undefined` or `[]` → `[]`)
  - `laneDecisions(decisions, laneId) -> {open, answered, checks}` (open = `kind !== "check"` and no `answer`; answered = has `answer`; checks = `kind === "check"`)
  - `openCount(decisions, laneId?) -> number` (open decisions + checks not `done`; all lanes when `laneId` is omitted)
  - `answerPatch(decision, choice, note, today) -> patch`: `{answer, answeredOn, own, note, reply: DEL, replyOn: DEL, appliedOn: DEL}` where `DEL = {"__delete__": true}`; `choice` is an option index or a non-empty string; free text sets `own: true`, an option sets `own: DEL`; an empty `note` sets `note: DEL`
  - `pinsByStep(brief, decisions, laneId) -> {prod, release, next, later}`, each an array of `{kind: "decision"|"check"|"watch", id, n}`, decisions then checks then watch; `n` numbers open decisions 1..k across the lane in `order`, checks and watch items separately; a decision or check with no `phase`, a phase not in `brief.phases`, or a phase with no `step` pins to `release`
  - `waitGap(lane, today) -> {days, from} | null` (only when `stage ∈ {review, preview, ready}` and `brief.builtOn` exists)
  - `collisionAsOf(snapshot) -> "YYYY-MM-DD" | null` and `collisionStale(snapshot, today) -> boolean` (> 3 days)
  - `validateBrief(brief) -> string[]`: missing `goal` or `phases`; none of `tracker`, `plan`, `spec`; a phase without `id`/`name`, a `status` outside `shipped|built|building|decided|plan|spec|idea|parked`, or a `step` (when present) outside `prod|release|next|later|parked`; `steps` keys outside `prod|release|next|later`; `areas` over 7 rows or a row without `area`/`files`; `timeline` rows without `date`/`label`; `watch` over 3; `decided` over 6; any old-shape key `open`, `notes`, `orientPage`, `statusBlock`, `pr`. Empty means valid
  - `validateDecision(doc) -> string[]`: missing `question`; `kind` outside `decision|check`; `options` not an array of strings or `{label}` objects; `lane` not a string or `null`
  - `docId(laneId, key, taken) -> string`: `<laneId>-<slug>`, slug = `key` lowercased, runs of anything but `a-z0-9` → `-`, trimmed, at most 40 chars; `-2`, `-3`… while the id is in the `taken` set (which it then joins)
  - `migrateBrief(lane, today, sort = {}) -> {brief, notes, decisions}`: removes the old keys; each `owner: "you"` item → a doc with id `docId(lane.id, item.id ?? item.text, taken)`, `lane`, `phase: null`, `kind: sort[id] === "check" ? "check" : "decision"`, `question` = text, `ref` = item id or `null`, `options: []`, `askedBy: "migrated"`, `askedOn: today`; items with `sort[id] === "drop"` are left out; `owner: "agent"` texts appended to `brief.agent`; `lane.risk` appended to `brief.watch`; `brief.notes` joined onto the lane's `notes` with " · "; `decided` keeps the 6 newest rows

- [ ] **Step 1: Write the failing tests**

```js
import test from "node:test"; import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "../lane-core.js"; const C = globalThis.LaneCore;
import { loadLanes } from "./fixtures.mjs";
const DEL = {"__delete__": true};
const VALID_DV_BRIEF = JSON.parse(readFileSync(new URL("./fixtures/brief-data-views.json", import.meta.url)));
test("isEpic", () => { assert.equal(C.isEpic({phases: Array(5).fill({})}), true); assert.equal(C.isEpic({phases: Array(4).fill({})}), false); assert.equal(C.isEpic(undefined), false); });
test("normalizeOptions keeps legacy strings and empty lists", () => {
  assert.deepEqual(C.normalizeOptions(["Yes", {label: "No", consequence: "c"}]), [{label: "Yes", consequence: ""}, {label: "No", consequence: "c"}]);
  assert.deepEqual(C.normalizeOptions([]), []); assert.deepEqual(C.normalizeOptions(undefined), []);
});
test("answerPatch clears the agent's reply and any stale own or note", () => {
  const d = {options: ["A", {label: "B", consequence: "x"}]};
  assert.deepEqual(C.answerPatch(d, 1, "", "2026-11-16"), {answer: "B", answeredOn: "2026-11-16", own: DEL, note: DEL, reply: DEL, replyOn: DEL, appliedOn: DEL});
  assert.deepEqual(C.answerPatch(d, "  my own  ", "only if cheap", "2026-11-16"), {answer: "my own", answeredOn: "2026-11-16", own: true, note: "only if cheap", reply: DEL, replyOn: DEL, appliedOn: DEL});
  assert.throws(() => C.answerPatch(d, "   ", "", "2026-11-16"));
});
test("localDay is the local calendar day", () => assert.equal(C.localDay(new Date(2026, 10, 16, 23, 30)), "2026-11-16"));
test("waitGap", () => {
  assert.deepEqual(C.waitGap({stage: "review", brief: {builtOn: "2026-10-23"}}, "2026-11-14"), {days: 22, from: "2026-10-23"});
  assert.equal(C.waitGap({stage: "build", brief: {builtOn: "2026-10-23"}}, "2026-11-14"), null);
  assert.equal(C.waitGap({stage: "review", brief: {}}, "2026-11-14"), null);
});
test("collision staleness reads the leading date of asOf", () => {
  const s = {asOf: "2026-11-13, branches as held after the drain"};
  assert.equal(C.collisionAsOf(s), "2026-11-13");
  assert.equal(C.collisionStale(s, "2026-11-16"), false);
  assert.equal(C.collisionStale(s, "2026-11-17"), true);
});
test("pins, lane decisions and the open count", () => {
  const ds = [{id: "a", lane: "dv", phase: "DV4", order: 1}, {id: "b", lane: "dv", phase: "DV10", order: 2}, {id: "z", lane: "dv", phase: "DV11", order: 3}, {id: "c", lane: "dv", kind: "check"}, {id: "d", lane: "dv", kind: "check", done: true}, {id: "x", lane: "other", phase: "DV4"}, {id: "y", lane: "dv", phase: "DV4", answer: "A"}];
  const brief = {phases: [{id: "DV4", step: "release"}, {id: "DV10", step: "later"}, {id: "DV11"}], watch: ["w"]};
  const p = C.pinsByStep(brief, ds, "dv");
  assert.deepEqual(p.release.map(x => x.kind + x.n), ["decision1", "decision3", "check1", "watch1"]);
  assert.deepEqual(p.later.map(x => x.id), ["b"]);
  assert.deepEqual(Object.values(C.laneDecisions(ds, "dv")).map(a => a.length), [3, 1, 2]);
  assert.equal(C.openCount(ds, "dv"), 4);
  assert.equal(C.openCount(ds), 5);
});
test("deps, activeDeps, groupOf and findCycle", () => {
  assert.deepEqual(C.deps({stackedOn: "a", blockedBy: ["a", "b", null]}), ["a", "b"]);
  const m = {a: {id: "a", stage: "build"}, b: {id: "b", stage: "shipped"}, p: {id: "p", stage: "build", move: "parked"}};
  assert.deepEqual(C.activeDeps({stackedOn: "p", blockedBy: ["a", "b", "ghost"]}, m), ["p", "a"]);
  assert.equal(C.groupOf({id: "c", move: "you", blockedBy: ["a"]}, m), "blocked");
  assert.equal(C.groupOf({id: "c", move: "you", blockedBy: ["p"]}, m), "blocked");
  assert.equal(C.groupOf({id: "c", move: "you", blockedBy: ["b"]}, m), "you");
  const L = [{id: "a", stage: "build", blockedBy: ["b"]}, {id: "b", stage: "build", blockedBy: ["a"]}, {id: "c", stage: "build", blockedBy: ["a"]}, {id: "d", stage: "build"}];
  assert.deepEqual(C.findCycle(L).sort(), ["a", "b"]);
});
test("migrateBrief converts the old open list", () => {
  const lane = {id: "casl-285", risk: "lint wall may slip", notes: "lane note", brief: {goal: "g", tracker: "t", phases: [], notes: "brief note", orientPage: "u", statusBlock: "s", pr: {checks: "ok"},
    decided: [1, 2, 3, 4, 5, 6, 7, 8].map(i => ({date: "2026-11-0" + i, text: "t" + i})).reverse(),
    open: [{id: "DB1", owner: "you", text: "Rules in the database?"}, {id: null, owner: "you", text: "Merge PR #289 first"}, {id: "c0 task 9", owner: "you", text: "iPad check of the chip"}, {id: null, owner: "you", text: "Rules in the database?"}, {id: "J6", owner: "agent", text: "Shape of the lint wall"}]}};
  const r = C.migrateBrief(lane, "2026-11-16", {"casl-285-merge-pr-289-first": "drop", "casl-285-c0-task-9": "check"});
  assert.deepEqual(r.decisions.map(d => [d.id, d.kind, d.ref]), [["casl-285-db1", "decision", "DB1"], ["casl-285-c0-task-9", "check", "c0 task 9"], ["casl-285-rules-in-the-database", "decision", null]]);
  assert.deepEqual(r.decisions[0], {id: "casl-285-db1", lane: "casl-285", phase: null, kind: "decision", question: "Rules in the database?", ref: "DB1", options: [], askedBy: "migrated", askedOn: "2026-11-16"});
  assert.deepEqual(r.brief.agent, ["Shape of the lint wall"]); assert.deepEqual(r.brief.watch, ["lint wall may slip"]);
  assert.equal(r.notes, "lane note · brief note");
  assert.deepEqual(r.brief.decided.map(d => d.date), ["2026-11-08", "2026-11-07", "2026-11-06", "2026-11-05", "2026-11-04", "2026-11-03"]);
  for (const k of ["open", "notes", "orientPage", "statusBlock", "pr"]) assert.ok(!(k in r.brief), k);
});
test("docId slugs, trims and suffixes", () => {
  const taken = new Set();
  assert.equal(C.docId("hv", "Lot on the prod page?", taken), "hv-lot-on-the-prod-page");
  assert.equal(C.docId("hv", "Lot on the prod page!", taken), "hv-lot-on-the-prod-page-2");
});
test("migrated ids on the real lanes are unique and legal", () => {
  const ids = loadLanes().filter(l => l.brief).flatMap(l => C.migrateBrief(l, "2026-11-16").decisions.map(d => d.id));
  assert.equal(ids.length, 47);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z0-9-]+$/);
});
test("validateBrief and validateDecision", () => {
  assert.deepEqual(C.validateBrief(VALID_DV_BRIEF), []);
  assert.ok(C.validateBrief({goal: "x"}).length > 0);
  assert.ok(C.validateBrief(loadLanes().find(l => l.id === "data-views").brief).some(p => p.includes("open")));
  assert.deepEqual(C.validateDecision({question: "q", kind: "decision", options: ["A", {label: "B"}], lane: null}), []);
  assert.ok(C.validateDecision({kind: "x"}).length > 0);
});
test("every live fixture lane migrates to a valid brief and valid docs", () => {
  for (const l of loadLanes().filter(l => l.brief)) {
    const r = C.migrateBrief(l, "2026-11-16");
    assert.deepEqual(C.validateBrief(r.brief), [], l.id);
    for (const d of r.decisions) assert.deepEqual(C.validateDecision(d), [], d.id);
  }
});
```

`brief-data-views.json` is the Data views brief in the spec §4.4 shape, built from `test/fixtures/lanes/data-views.json` plus the studies page's B+ data (areas, timeline, steps).

- [ ] **Step 2:** Run the tests → FAIL (`LaneCore` undefined).
- [ ] **Step 3:** Implement the functions in `lane-core.js` inside an IIFE. In `page.html`, add `<script src="lane-core.js"></script>` before the main script; replace the page's `deps`, `live`, `groupOf` and `today` definitions with `const deps = LaneCore.deps` (and so on); `relText` filters with `LaneCore.activeDeps`; `order()` keeps its readiness loop for ordering but marks `cycle: true` only on ids `LaneCore.findCycle` returns.
- [ ] **Step 4:** Run the tests → all PASS; harness `now` and `lane-data-views` → `consoleErrors: []`, `checks.nowGroups` equals `test/baseline/now-groups.json`, `checks.text.now` equals `test/baseline/now.txt`.
- [ ] **Step 5:** Commit: `feat(ship-board): lane-core pure functions and schema`.

### Task 2: Blocker map layout

**Files:**
- Modify: `.claude/skills/ship-board/lane-core.js`
- Test: `.claude/skills/ship-board/test/blocker-layout.test.mjs`

**Interfaces:**
- Consumes: `LaneCore.activeDeps`, `LaneCore.isLive`, `LaneCore.findCycle`.
- Produces: `LaneCore.layoutBlockerMap(laneId, lanes, snapshot) -> {width, height, nodes:[{id, x, y, w, h, col: 0|1|2|3|"overlap", more?: string[], parked?: true}], edges:[{from, to, kind: "stack"|"wait"|"conflict"|"clean", label}], cycle: string[]}`.
  - Columns: 0 (waits on: `activeDeps(lane)`, parked ones flagged `parked: true`), 1 (this lane), 2 (live lanes whose deps include this lane), 3 (live lanes whose deps include a column-2 lane).
  - The overlap row holds lanes sharing files with this lane in `snapshot.pairs` and not already placed; parked lanes are allowed there, with `parked: true`.
  - Sizes and caps come from Global Constraints. A capped column's 4th node is `{id: "more:<col>", more: [ids]}`.
  - An empty column 0 gets one node `{id: "none:0"}` ("no other lane").
  - `cycle` = the `findCycle` ids on a loop that includes this lane (`[]` otherwise); each lane is placed once.

- [ ] **Step 1: Write the failing tests** using the real fixtures:

```js
import test from "node:test"; import assert from "node:assert/strict";
import "../lane-core.js"; const C = globalThis.LaneCore;
import { loadLanes, loadSnapshot } from "./fixtures.mjs";
const L = loadLanes(), S = loadSnapshot();
const lane = (id, o = {}) => ({id, name: id, stage: "build", move: "agent", ...o});
const col = (m, c) => m.nodes.filter(n => n.col === c).map(n => n.id).sort();
test("data views columns", () => {
  const m = C.layoutBlockerMap("data-views", L, S);
  assert.deepEqual(col(m, 0), ["none:0"]); assert.deepEqual(col(m, 1), ["data-views"]);
  assert.deepEqual(col(m, 2), ["filter-rules", "long-names", "proposal-page"]); assert.deepEqual(col(m, 3), ["pe4"]);
  assert.deepEqual(col(m, "overlap"), ["hv", "office-tv"]);
  const e = (a, b) => m.edges.find(x => x.from === a && x.to === b)?.kind;
  assert.equal(e("data-views", "filter-rules"), "stack"); assert.equal(e("data-views", "proposal-page"), "wait");
  assert.equal(e("data-views", "hv"), "conflict"); assert.equal(e("data-views", "office-tv"), "clean");
  assert.equal(m.nodes.find(n => n.id === "hv").parked, true);
});
test("unknown and shipped deps are left out, a parked one is drawn parked", () => {
  const lanes = [...L.map(l => l.id === "drain" ? {...l, stage: "shipped"} : l), lane("z", {blockedBy: ["ghost", "drain"], stackedOn: "hv"})];
  const m = C.layoutBlockerMap("z", lanes, S);
  assert.deepEqual(col(m, 0), ["hv"]); assert.equal(m.nodes.find(n => n.id === "hv").parked, true);
});
test("more than four in a column collapses", () => {
  const lanes = [lane("hub"), ...[1, 2, 3, 4, 5, 6].map(i => lane("w" + i, {blockedBy: ["hub"]}))];
  const m = C.layoutBlockerMap("hub", lanes, {pairs: []});
  const c2 = m.nodes.filter(n => n.col === 2);
  assert.equal(c2.length, 4); assert.equal(c2[3].id, "more:2"); assert.deepEqual(c2[3].more, ["w4", "w5", "w6"]);
});
test("a loop is reported once, without the lane that only waits on it", () => {
  const m = C.layoutBlockerMap("a", [lane("a", {blockedBy: ["b"]}), lane("b", {blockedBy: ["a"]}), lane("c", {blockedBy: ["a"]})], {pairs: []});
  assert.deepEqual([...m.cycle].sort(), ["a", "b"]);
  assert.equal(m.nodes.filter(n => n.id === "b").length, 1);
});
test("nodes never overlap and stay inside width/height", () => {
  const m = C.layoutBlockerMap("data-views", L, S);
  for (const n of m.nodes) assert.ok(n.x >= 0 && n.y >= 0 && n.x + n.w <= m.width && n.y + n.h <= m.height, n.id);
  for (const a of m.nodes) for (const b of m.nodes) if (a !== b)
    assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, a.id + "/" + b.id);
});
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement `layoutBlockerMap` (columns by breadth-first steps from the lane; rows centred per column; overlap row below the tallest column). **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit: `feat(ship-board): blocker map layout`.

### Task 3: Lane page renderers and side panel

**Files:**
- Create: `.claude/skills/ship-board/lane-view.js`
- Modify: `.claude/skills/ship-board/page.html`:
  - Remove the old `renderLaneView`, `panel` (archive line 535), `PH` (534), the `.panel` CSS (220–225) and the `.lp-*` CSS; none has another caller.
  - Add `<script src="lane-view.js"></script>` after `lane-core.js`.
  - `route()` sets `S.sel = null` when `S.lane` changes.
  - Subscribe the lane view to the `decisions` and `snapshots/collisions` listeners (archive lines 788–789), as well as `lanes`.
  - Add the lane-view CSS lifted from the studies page's B+ rules: `.bmap`, `.bars`, `.tl`, `.map`, the step cards, `.stand`, `.phstrip`/`.phkey`, `.watch`, `.agent` lists, `.pin`/`.pins`, the legend `.lg`. Scope every rule under `#lane-view` and rename it `lb-*`. Re-token `--accent-soft`→`--agent-soft`, `--risk`→`--blocked`, `--risk-soft`→`--blocked-soft`, `--idle`→`--parked`. Re-map the chip classes `.acc`→`.agent`, `.risk`→`.blocked`. `#lane-view` gets `container-type: inline-size`.
- Test: `test/lane-view.checks.mjs` (a `--script` for the harness)

**Interfaces:**
- Consumes: `LaneCore.*` (Tasks 1–2); page globals `S`, `el`, `$`, `laneMap`, `ago`, `previewFact`, `facts` (archive line 536), `stageLabel`, `moveChip`, `editForm` (614), `sessionOn`, `relText` (486, edge labels), `wrapWords` (683, node-name truncation), and `drawFlow`'s SVG element helper (703), hoisted to a shared `svgEl`.
- Produces: `renderLaneView()` (replaces the page's), and on `window`: `laneHeader(l)`, `whereItStands(l, ds)`, `blockerMapSvg(layout)`, `areaBars(brief)`, `waitTimeline(l)`, `decisionsList(l, ds)` (Task 4 fills its cards), `inspector(l, ds)`.
  - Selection state `S.sel = {t, id} | null`, with `t ∈ status | lane | step | decision | check | watch | area | milestone | gap | more`. Every clickable carries `data-sel="t:id"`. A `S.sel` whose target no longer exists falls back to status.
  - One delegated handler on `#lane-view` sets `S.sel` and re-renders only the inspector and the `[aria-pressed]` states; one Enter/Space relay activates `[data-sel]` SVG nodes (as the studies page does).
  - SVG nodes: `tabindex="0"`, `role="button"`.
  - The status panel lists stage, whose move, PR, preview, session, next, branch, tracker, and the details the old view showed: `notes`, worktree, port, Neon branch, last commit, ahead/behind.

- [ ] **Step 1: Write the failing harness checks.** Run them for `#lane-data-views`, `#lane-r19`, `#lane-pe4`, `#lane-hv` (parked), `#lane-superseded` (no brief), `#lane-dev-flow` (no branch), `#lane-long-names` and `#lane-nope` (unknown), at 1280×800, 1440×900, 820×1180 and 390×844, in light and dark.
  - **Sections:**
    - Data views, with `--brief=data-views=test/fixtures/brief-data-views.json`: `checks.sections` equals `["header","stands","blocks","lands","waited","decisions","folded"]`.
    - Data views with its old-shape fixture brief: `["header","stands","blocks","decisions","folded"]` plus `[data-empty="brief"]`; superseded: `["header","stands","blocks","decisions"]` plus `[data-empty="brief"]`.
    - dev-flow: no `lands` and no `waited`, and its panel text says why.
    - `#lane-nope`: the back link and "No lane called nope". With `--delay=lanes=3000`: "Loading lane." until the lanes arrive.
  - **Release map:** `checks.releaseMap` is true for Data views and R19, false for pe4 (phase strip instead). R19's status panel shows its PR number and its preview line. Data views' old-shape brief (no `step`) draws every phase under "This release".
  - **Header:** it holds the editor button; clicking it opens `form.edit`. Its chips (`N waiting on you`, `N risks`, `holds up N lanes`) each change the inspector's `data-kind`.
  - **Inspector:** clicking every `[data-sel]` kind present (decision and check pins included, from the `extra/` fixtures) changes `#lane-inspector [data-kind]` to that kind; focusing an SVG node and pressing Enter does the same. "Back to status" returns `data-kind="status"`. Selecting a pin on Data views, then navigating to `#lane-r19`, shows `data-kind="status"`.
  - `checks.inspectorMode` is `"side"` at 1280 and 1440, and `"sheet"` at 820 and 390.
  - With `--order=lanes,collisions,decisions`, the decision pins and the overlaps row appear once the late collection arrives.
  - **Every state:** `overflowPx === 0`, no SVG `<text>` box outside the viewBox, every SVG label's rendered font size ≥ 12 px, no two node boxes intersecting, `consoleErrors` empty, `checks.text.reference` equals `test/baseline/reference.txt` and `checks.nowGroups` equals the baseline.
- [ ] **Step 2:** Run the harness → FAIL (sections missing).
- [ ] **Step 3:** Implement `lane-view.js` (IIFE) per spec §3 and §4.2:
  - the blocker map from `LaneCore.layoutBlockerMap`: edge labels from `relText`, `blockReason` and pair counts; parked nodes dashed; a stale snapshot gets an "as of <date>" label in `--you`; the cycle and the "+N more" list open in the panel;
  - the release map from `brief.steps` and `pinsByStep`;
  - the wait gap from `waitGap`;
  - the inspector's status list from `facts()` and `previewFact`.

  SVG node names are truncated with `wrapWords`; the full name shows in the panel.
- [ ] **Step 4:** Run the harness → all checks pass; look at the Data views screenshots at 1280 and 390, light and dark, against the studies page B+.
- [ ] **Step 5:** Commit: `feat(ship-board): lane page pictures and side panel`.

### Task 4: Answers, Decisions tab, Now chips

**Files:**
- Modify: `.claude/skills/ship-board/lane-view.js` (adds `decisionCard`)
- Modify: `.claude/skills/ship-board/page.html`:
  - `renderDecisions` uses `decisionCard`; the `.dec`, `.opts`, `.rec` CSS (archive lines 135–141) goes.
  - The decisions listener (788) calls `renderDecisions(); renderLanes()`, so the Now chips redraw.
  - The tab badge (657) and "Yours" (522) count with `LaneCore.openCount(S.decisions)`.
  - `treeRow` gets the `N waiting on you` chip.
- Test: `test/decisions.checks.mjs` (a `--script` for the harness)

**Interfaces:**
- Consumes: `LaneCore.answerPatch`, `normalizeOptions`, `laneDecisions`, `openCount`, `localDay`, `validateDecision`; page `save(col, id, patch) -> Promise<boolean>` (archive line 779; resolves `false` after its own toast, and switches the page read-only on `invalid_argument`); `S.canWrite`, `S.db`.
- Produces: `window.decisionCard(d, {compact: boolean}) -> HTMLElement`, the one card the lane page and the Decisions tab both use, root class `lb-card`.
  - The card shows the question, `context`, `area`, the options with their consequence (Claude's pick marked), a free-text answer and a note. `options: []` shows free text only.
  - An answered card shows the answer, the note, and `reply` when present, else "Answered · waiting for the agent". "Change answer" reopens it.
  - Unsent text in the card's inputs is kept in `S.drafts[d.id]` and restored on every re-render, wherever the card is drawn.
  - Writable is read at render time from `S.canWrite && S.db`; when not, inputs are disabled and the card shows "This view can't save answers".
  - Owner checks render as a tick box and toggle `done`.
  - The Decisions tab groups by lane (lane-less first) and counts an owner check as open until `done`.

- [ ] **Step 1: Write the failing harness checks:**
  - Answer option 2 of the first open decision on `#lane-data-views`, with the note "only if cheap" → `window.__updates` gains exactly one entry: `{path: "decisions/<id>", patch: {answer: "<label of option 2>", answeredOn: "<localDay>", own: DEL, note: "only if cheap", reply: DEL, replyOn: DEL, appliedOn: DEL}}`.
  - A free-text answer "ship it later" on the migrated `casl-285-db1` doc (no options) → one update with `own: true`.
  - "Change answer" on the answered Data views fixture (free text, note, `reply`, `appliedOn`), then an option with no note → one update with `own: DEL`, `note: DEL` and `reply`, `replyOn`, `appliedOn` deleted. The card then shows "Answered · waiting for the agent".
  - Typing "draft text" into a decision's free-text input, then firing a lane snapshot (mock update on `lanes/data-views` `session.lastSeen`) and then a decisions snapshot, leaves the input value at "draft text", on the lane page and in the Decisions tab.
  - With `--reject-next` → the toast is shown, the card still shows its options, and there is no second update. With `--reject-next=invalid_argument` → the cards turn read-only after the toast.
  - With `--read-only` → the inputs are `disabled` and the card shows "This view can't save answers".
  - The Decisions tab renders all 11 pulled decisions (legacy string options) and the 5 `extra/` docs, each with its `context`, `area`, `note` and `reply`, styled (computed style of `.lb-card` has a border).
  - The owner check renders as a tick box (not a radio form). Ticking it writes `{done: true}`. It counts as open until then.
  - The Now row for Data views shows `3 waiting on you` (2 open decisions and 1 open check), also when decisions arrive after lanes (`--order=lanes,decisions`).
  - The page's own copy never says "call" or "calls": no match for `/\bcalls?\b/i` in the static text of `#lane-view` and the Decisions tab headings, buttons and labels (lane and decision data excluded; the Reference tab is not the page's lane copy).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS, and Task 3's checks still pass; look at the Decisions tab at 1280 and 390, light and dark.
- [ ] **Step 5:** Commit: `feat(ship-board): answers saved on the page; decisions grouped by lane`.

### Task 5: `/orient` rewritten as a board writer

**Files:**
- Modify: `.claude/skills/orient/SKILL.md` (frontmatter description included), `.claude/skills/orient/REFERENCE.md`, `CLAUDE.md` (the `/orient` line under "Planning", matched by its text: "a lean page, a decision sheet" → "a briefing on the lane's board page")
- Delete: `.claude/skills/orient/templates/epic-page.src.html`, `.claude/skills/orient/templates/plan-page.src.html`
- Create: `.claude/skills/ship-board/scripts/check-brief.mjs` (reads a JSON file holding a brief or `{brief, decisions}`, prints `LaneCore.validateBrief` and each `validateDecision` problem, exits 1 when any)

**Interfaces:**
- Consumes: `ship-board/SKILL.md` (schema pointer, apply rules); `check-brief.mjs`.
- Produces: the workflow in spec §4.5, steps 1–7 plus `--dry`, in intent. These rules must appear:
  - lane matching on `branch`, then `brief.tracker`, `brief.plan`, `brief.spec`; more than one match → ask the owner;
  - a new lane's stage from the status block by the mapping brainstorm→idea, spec→spec, plan→plan, building→build, built→review, shipped→shipped;
  - step 2 points to `ship-board/SKILL.md`'s apply rules (target order, worktree copy, the clean-file guard); it does not restate them;
  - lane-less docs are never applied by a lane run;
  - decision doc ids by `docId`, and open docs compared by `ref` and question text before writing;
  - a failed pinned write is re-read and redone once;
  - the four question categories and the cap of four (today in REFERENCE.md's "Decision sheet") move into SKILL.md before that section goes;
  - the Rules list: "never DB writes" becomes "no app DB writes; board writes follow ship-board"; "another session's worktree is never entered" gains the apply-rule exception; the edit allowlist names the `--dry` output file (scratchpad by default);
  - the helper-script exception for `ship-board/scripts/check-brief.mjs`;
  - `--dry` runs steps 1–5 and prints the would-be brief, decision docs, ruling rows and decision patches.

  REFERENCE.md pins the exact commands:
  - areas: `git diff --name-only <base>...<ref> | awk -F/ '{n=NF; k=($1=="src")?(n>=4?$2"/"$3:(n==3?$2:"src")):(n>1?$1:"(root)"); c[k]++} END{for(k in c) print c[k], k}' | sort -rn`, where `<base>` is the `stackedOn` lane's branch for a stacked lane, else `origin/main`; top six plus "other";
  - collisions per pair: `git merge-tree --write-tree --name-only --no-messages <ref> <other>` (exit 1 = conflicts; the file list follows the tree line), and `merge-base --is-ancestor` for stacked pairs;
  - the status block `page:` value `https://claude.ai/artifact/7D8kgccA7iy6f8ATWzLdqS#lane-<id>`.

  Keep: the inputs table, altitudes, the three checks, the status block, speed discipline (its roadmap `decisions` read stays, named "the roadmap's decisions" to tell it from the board's) and the read-only rule toward app code. Delete: §Pages, every visual-explainer reference, and the "Decision sheet" section. Keep "Cold-start ranking" and §Write-back's ruling-ID and memory rules.

- [ ] **Step 1:** Rewrite both files; delete `templates/`; edit the `CLAUDE.md` line.
- [ ] **Step 2:** In a session started in the worktree, dry run on the Data views tracker: `/orient docs/plans/2026-10-12-data-views-epic.md --dry .claude/skills/ship-board/test/fixtures/brief-data-views.orient.json` (ref `feat/data-views`, read via `git ls-tree`/`git show`, no checkout).
  - `git status` shows no other changed file.
  - `node .claude/skills/ship-board/scripts/check-brief.mjs .claude/skills/ship-board/test/fixtures/brief-data-views.orient.json` → exit 0.
  - Its `areas` total equals `git diff --name-only origin/main...feat/data-views | wc -l` (227 on 2026-11-15).
  - Its ruling rows are empty, and none of the 11 lane-less board decisions appears among its patches.
- [ ] **Step 3:** Dry run on `filter-rules`, which is stacked on data-views, to the scratchpad. Its `areas` total equals `git diff --name-only feat/data-views...feat/filter-rules | wc -l` (14), not 227.
- [ ] **Step 4:** Swap the Data views file into the harness (`--brief=data-views=test/fixtures/brief-data-views.orient.json`) → Task 3's checks still pass.
- [ ] **Step 5:** Commit: `feat(orient): write the briefing to the ship board instead of a page`.

### Task 6: `session-capture` and the lane hook (user level, outside the repo)

**Files:**
- Modify: `~/.claude/skills/session-capture/SKILL.md` (spec §4.6, as a section that applies only when the session's repo is Tri Pros and the lane hook linked it; it points to ship-board's apply rules by the absolute worktree path)
- Modify: `~/.claude/hooks/lane-context.sh` (spec §4.7: step 3 reads `brief.tracker`, else `brief.plan`; one numbered instruction added after step 1 that points to `<ship-board>/SKILL.md` for the apply rules, `<ship-board>` set once at the top of the script to the worktree's absolute path)

- [ ] **Step 1:** Copy both files to the scratchpad, then edit both.
- [ ] **Step 2:** Pipe-test the hook:
  - `echo '{"cwd":"<repo>/.worktrees/data-views","session_id":"t","source":"startup"}' | ~/.claude/hooks/lane-context.sh | jq -r .hookSpecificOutput.additionalContext` → contains `appliedOn`, the absolute `ship-board/SKILL.md` path (and that path exists), and `brief.tracker`;
  - for the main checkout and for `/tmp` → empty output, exit 0.
- [ ] **Step 3:** `grep -n "Tri Pros" ~/.claude/skills/session-capture/SKILL.md` shows the scope condition on the new section, and `diff` against the scratchpad copy shows nothing else changed.
- [ ] **Step 4:** No commit (files are outside the repo); list both paths in the PR description.

### Task 7: Publish, backfill, live checks

**Files:** none in the repo; board data and the published artifact. Run from a session started in the worktree.

- [ ] **Step 1: Backup.** `ArtifactData` `list` with `out_dir` `~/claude-archive/<today>-board-backfill/` for `lanes` and `decisions`, and `get` for `snapshots/collisions`. Note each doc's version. Copy the v6 archive page there too.
- [ ] **Step 2: Build, offline.**
  - Sort the 47 old owner items (`migrateBrief` ids): each is a decision, an owner check (a to-do such as "Merge PR #289"), or dropped (already settled by a later `decided` row or ruling, or a repeat of another lane's item, e.g. "Lot on the prod page" on scene-lab and trade-scenes). Write the sort to a scratchpad JSON `{<docId>: "check" | "drop"}` with a one-line reason per entry.
  - For each of the 13 lanes with a brief, run `migrateBrief(lane, today, sort)`, then fill in the §4.4 fields with Task 5's commands: areas, collisions, timeline, `builtOn`, `steps` for epics, `stand`, `watch`, `agent`. The three Data views questions from the studies page get options with consequences; where one matches a migrated item (same `ref` or question), it updates that doc instead of adding one.
  - For the 11 existing decisions, list which get `appliedOn: "2026-11-15"` (`replyOn` on or after `answeredOn`) and which are left for the agent.
  - Write each result to the scratchpad and check it with `check-brief.mjs` → exit 0 for all.
- [ ] **Step 3: Ask the owner to go**, with the counts (13 lanes, N decisions, N checks, N dropped, 11 docs and how many get `appliedOn`, the snapshot) and the sorted list with reasons. The owner approves or edits the sort.
- [ ] **Step 4: Publish** `page.html` with `files` `lane-core.js` and `lane-view.js` to the board URL (the new page draws both old- and new-shape data; v6 cannot draw the new docs). Read it back once.
- [ ] **Step 5: Batch 1** (creates only, deterministic ids): the migrated and Data views docs, in batches of up to 50. Record the created ids beside the backup. On a re-run, first `query` which of the ids exist and send only the missing ones.
- [ ] **Step 6: Batch 2** (pinned): 13 lane `update`s, `appliedOn: "2026-11-15"` on the listed decisions, and `snapshots/collisions` with fresh pairs and `asOf`. A version failure means re-reading that doc, rebuilding its entry, and re-sending once.
  - Each lane update writes the new `brief` object with the old keys deleted explicitly (`open`, `notes`, `orientPage`, `statusBlock`, `pr` set to `{"__delete__": true}` inside `brief`, because an update may merge nested objects), plus `briefAt`, `notes`, and `risk: {"__delete__": true}` where the lane had one.
- [ ] **Step 7: Read back.** Read every lane and every created doc once and run `check-brief.mjs` on each → all exit 0. No lane still has `brief.open` or `risk`. If anything is wrong and cannot be fixed forward, run the rollback in `ship-board/SKILL.md`.
- [ ] **Step 8: Live `/orient` run** on a plan that has no lane (the owner picks which, and says go). A lane is created and its brief passes `check-brief.mjs`.
- [ ] **Step 9:** Ask the owner to answer one Data views decision on the live page. Read that doc once with `ArtifactData` and confirm `answer`, `answeredOn` and no `appliedOn`. Then `/orient docs/plans/2026-10-12-data-views-epic.md --dry` → exactly one ruling row, for that doc, aimed at the tracker copy in `.worktrees/data-views` (or a note that the file has uncommitted edits). Report what was exercised and what was not.
- [ ] **Step 10:** Update memory `project-dev-flow-rework.md`: the board source path, a pointer to the schema in `lane-core.js` (not a copy), the vocabulary, the interim absolute paths, the published version and the backup path.

### Ship

- [ ] Run the citation grep from Global Constraints and `pnpm lint && pnpm tsc` in the worktree.
- [ ] Push `chore/orient-lane-briefing` and open a PR targeting `release/2026-11-13-drain` **only after the owner says so** (outward action). Description: what changed, the two user-level files from Task 6, the harness and test commands, and the board version published.
- [ ] When #289 squash-merges: retarget this PR to `main` and `git merge origin/main` into the branch (never rebase, never force-push), `pnpm lint && pnpm tsc`; push only after the owner says so. The diff should show only this branch's files.
- [ ] Last commit on the branch: delete the spec and this plan (`git rm` by path).
- [ ] After the PR merges and local main is pulled: switch the hook's `<ship-board>` and `session-capture`'s path to the main checkout, re-run Task 6's pipe test, and update the memory line.

## Self-review

- **Spec coverage:**

  | Spec | Plan |
  |---|---|
  | §2 decisions 9–15 | T1 (`migrateBrief`, `docId`, sort), T7 (sort approval, order), T0 (fixtures, apply rules), T4 (chip), T6/Ship (interim paths), Global Constraints |
  | §3 content | T3 (editor kept, status details, unknown lane), T4 (cards) |
  | §4.1 homes | T0 |
  | §4.2 | T1 (`activeDeps`, `groupOf`, `findCycle`), T3 (IIFE, subscriptions, `S.sel` reset, scoped CSS), T4 (drafts in the card) |
  | §4.3 | T2 |
  | §4.4 | T1 (`validateBrief`, `validateDecision`), T7 |
  | §4.5 | T5 (`--dry` with step 2, matching, stage mapping, dedupe, stacked base, categories), T0 (apply rules) |
  | §4.6–4.7 | T6, Ship |
  | §4.8 | T1 (`answerPatch`), T4 |
  | §5 backfill | T7 (backup, publish first, sort, created ids, rollback, `appliedOn` rule) |
  | §6 edge cases | Review Focus tests in T2–T4 |
  | §7 verification | T0, T3, T4 harness; T5 dry runs; T7 live `/orient`, live answer and apply dry run |
  | §8 files | T0, T1, T3, T5, T6, Ship (spec and plan deleted) |

- **Names** are the same in every task: `LaneCore.layoutBlockerMap`, `activeDeps`, `findCycle`, `docId`, `migrateBrief(lane, today, sort)`, `answerPatch(decision, choice, note, today)`, `openCount(decisions, laneId?)`, `pinsByStep`, `waitGap`, `validateBrief`, `validateDecision`, `decisionCard`, `S.sel`, `S.drafts`, `data-sel`, `lb-`.
- **Not covered on purpose** (spec §9): GitHub data, old orient pages, a scheduled collision refresh.
