# Orient reference

The shapes, commands and rules `SKILL.md` cites. Section names are stable; the skill links them by heading. `<ship-board>` is `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.claude/skills/ship-board`; the board is `https://claude.ai/artifact/7D8kgccA7iy6f8ATWzLdqS`.

## Status block

Every tracker and every plan carries this block directly under its title, replacing the old `> **Status:**` paragraph the first time `/orient` or `session-capture` touches the file. The `> **Goal:**` and `> **Design:**` lines beside it stay. Files not yet touched keep their paragraph; there is no migration sweep.

```md
> **Status**
> - Stage: plan · stress-tested 2026-10-22
> - Built on: `feat/proposal-energy-impact` · Verified at: `feat/proposal-energy-impact@abc1234` (2026-11-03) · page: https://claude.ai/artifact/7D8kgccA7iy6f8ATWzLdqS#lane-energy-impact
> - Done: EI0 lift; customer_utility_bills table
> - Next: EI1 sliders → EI2 chapter shell (EI1 first: EI2 reads its hook)
> - Open: Q-L (owner) · EI0 cool-roof fold (scenes branch)
> - Blocked: EI0 on feat/trade-scenes-foundation
```

Field rules, one line each, no sentence longer than a line, IDs over prose:

| Field | Value |
|---|---|
| `Stage` | one of `brainstorm · spec · plan · building · built · shipped`, then an optional qualifier and date (`stress-tested 2026-10-22`, `awaiting iPad check`, `unmerged`) |
| `Built on` | the ref the work lives on; `main` when it is on local main |
| `Verified at` | `ref@sha (date)` of the last `/orient` run; the next run's baseline. Only `/orient` writes `Verified at`; `session-capture` writes `Verified at: —` so a hot session's `Done` line is never mistaken for verified state |
| `page` | `https://claude.ai/artifact/7D8kgccA7iy6f8ATWzLdqS#lane-<id>`, the lane's page on the board |
| `Done` | task or phase IDs that are `done`, in order |
| `Next` | the ordered next steps, with the dependency in brackets when one step must precede another |
| `Open` | question IDs and blockers waiting on the owner or another plan |
| `Blocked` | what cannot move and on what, or `none` |

Which block is the checkpoint: the tracker's block for epic altitude, the plan's own block for plan altitude. A plan-altitude run never rewrites the tracker's `Verified at`; it rewrites the tracker's `Done`, `Next`, `Open` and `Blocked` only when the run changed them through rulings. The block is written to the lane's tracker copy under `<ship-board>/SKILL.md`'s "Which copy" and "Guard" rules.

Stage meanings: `brainstorm` = grilled, no design doc · `spec` = design written or approved, no plan · `plan` = plan written, nothing built · `building` = tasks in progress on a ref · `built` = every task `done` on the named ref but not on `origin/main` · `shipped` = reachable from `origin/main`.

## Checks

Always all three, never deeper. One named ref per plan checked (an epic uses each child's): the block's `Built on`, else the branch the tracker names for that plan, else the current worktree's HEAD. Confirm it with `git rev-parse --verify <ref>`; a ref that no longer exists (squash-merged and deleted under the ship flow) falls through to `origin/main`, the brief's `evidence` says so, and names found there make the stage `shipped`. No checkout; another session's worktree is never entered.

**Baseline**, first that applies: the block's `Verified at` sha · the tracker's `Baseline` line · the plan file's first commit (`git log --diff-filter=A --format=%h -- <plan>`) · for an untracked plan, the oldest commit touching any named file on or after the date in the plan's filename: `git log --reverse --format='%h %cs' <ref> -- <files>` and take the first row whose date is on or after that date (`--since` stops at an older interleaved commit and mis-reports). A baseline sha that is not an ancestor of the ref (`git merge-base --is-ancestor <sha> <ref>` fails; a squash merge happened) falls through to the next rung, and `evidence` says so.

### 1. Tasks against the tree

For each task heading (`grep -nE '^#{2,3} Task'`; plans here use both `##` and `###`), take the paths under **Files** and the names under **Interfaces › Produces** (tables, columns, DAL functions, procedures, hooks, components, constants). A plan or spec with no task headings gets no rows: check 1 reports "no task list", the stage is at most `spec`, and `evidence` says so instead of inventing tasks from prose.

```sh
git ls-tree -r --name-only <ref> -- <path>            # exists on the ref?
git grep -n -e '<name>' <ref> -- <path-or-dir>         # export present?
git grep -n -e '<name>' <ref> -- src                   # path gone: did the work land elsewhere?
```

| Verdict | When |
|---|---|
| `done` | every path exists and every name is found |
| `partial` | some paths or names found |
| `not started` | none found |
| `done · path stale` | the path is gone but the names are found elsewhere on the ref; add a `⚠️ Stale ref` line naming the real path |
| `not started · path gone` | the path is gone and the names are nowhere on the ref |

Evidence: `path` · `file:line` of the grep hit · `sha`. Checkboxes in the plan are read, never trusted.

### 2. Plan against git

```sh
git log --oneline <baseline>..<ref> -- <every file the plan names>
git diff --stat <baseline>..<ref> -- <files>            # only when a commit needs a closer look
```

Group the commits: made by this plan's tasks (message or files match a task) · made by something else. The second group is the **divergence list**; each entry keeps its sha and a five-word summary. `shipped` and `built` come from `git merge-base --is-ancestor <sha> origin/main`.

### 3. Requirements against the delta

For each spec decision or requirement ID (D1, K7, EI-D12, M3 …) and each ruling in the tracker's table:

| Verdict | Meaning |
|---|---|
| `still holds` | nothing in the divergence list, the rulings or the roadmap contradicts it |
| `holds, path stale` | the requirement stands but the plan's tasks to reach it no longer match the tree |
| `invalidated` | a newer ruling (tracker, memory, the roadmap's decisions) or a shipped change contradicts it; cite which |

Judge from the divergence list's diffs and the rulings, not from re-reading the named files.

**Tags.** Every verdict in all three checks is `verified` (a path, grep hit or commit was seen in this run) or `inferred` (judged from names, messages or status lines). A verdict the run cannot verify inside the budget is tagged `inferred`, not researched further.

## Brief

The schema is `validateBrief` in `<ship-board>/lane-core.js`; this section says where values come from, not which fields exist.

- **Phases.** Epic altitude: one per child, status from its verified stage (brainstorm→`idea`, building→`building`, built→`built`, shipped→`shipped`, the rest by the same name). Plan altitude: one per task, `done` on the ref → `built` (or `shipped` when on `origin/main`), `partial` → `building`, `not started` → `plan`.
- **Decided**: rulings and requirement IDs that `still hold`, newest first, capped as the validator says. **Watch**: stale refs, invalidated requirements, divergence that matters. **Agent**: what the code settled and what the agent will do next.
- **Evidence**: one line per verdict worth keeping, with its tag; `verifiedAt` = `ref@sha date`.
- **`lastCommit` and `aheadBehind`**: their shapes are the validator's. Values: `git log -1 --format='%h|%as|%s' <ref>` gives sha, date and subject; `git rev-list --left-right --count origin/main...<ref>` gives behind then ahead; `git merge-base --is-ancestor origin/main <ref>` (exit 0) gives `onCurrentProd`.
- **Check before writing:**

```sh
node /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.claude/skills/ship-board/scripts/check-brief.mjs <file.json>   # a brief or {brief, decisions}; prints each problem, exit 1 when any
```

## Pictures

**Areas.** `<base>` is the `stackedOn` lane's branch for a stacked lane, else `origin/main`:

```sh
git diff --name-only <base>...<ref> | awk -F/ '{n=NF; k=($1=="src")?(n>=4?$2"/"$3:(n==3?$2:"src")):(n>1?$1:"(root)"); c[k]++} END{for(k in c) print c[k], k}' | sort -rn
```

Keep the top six rows, sum the rest into one `other` row; `files` is the total of the list. Each row's `note` is one plain sentence on why the change lands there.

**Timeline** from the tracker's ruling dates and status block; **`builtOn`** is the date the last task went `done` (its commit date).

**Collisions**, for this lane against every live lane with a branch (`LaneCore.isLive`), per pair:

```sh
git merge-tree --write-tree --name-only --no-messages <ref> <other>   # exit 1 = conflicts; the conflicted file list follows the tree line
git merge-base --is-ancestor <base-branch> <stacked-ref>              # stacked pairs: is the stack still on its base?
```

`shared` is the count of files both branches change against `origin/main` (`comm -12` of the two sorted `git diff --name-only origin/main...<branch>` lists), `conflicts` the merge-tree file count, `files` the conflicted list. For a stacked pair, an ancestor base means no conflicts by construction; a base that is not an ancestor means the base moved, so run merge-tree and add a `watch` line. Replace every pair naming this lane in `snapshots/collisions`, keep the others, and set `asOf` to today's date.

## Board write

Read `lanes`, the lane's open `decisions` (`query` where `lane == <id>`) and `snapshots/collisions` with their versions before writing. One `ArtifactData` `batch` (at most 50 entries, each doc named once):

| Entry | op | Pin |
|---|---|---|
| `lanes/<id>`: `brief`, `briefAt`, and `stage`, `next`, `branch` when changed | `update` (`set` for a new lane) | `if_version` from the read; none for a new lane |
| `decisions/<doc id>` per question or owner check | `set` new, `update` existing | `if_version` on an existing doc |
| `snapshots/collisions`: `pairs`, `asOf` | `update` | `if_version` |

- **Stale brief keys**: `update` merges nested objects, so a `brief` written as is keeps every old key the new brief leaves out (an old `watch`, `builtOn`, `steps.later`, or `open`, `notes`, `pr` and `statusBlock` on a lane never backfilled). The lane entry's `brief` is the new brief plus `{"__delete__": true}` for each key of the read brief that the new one lacks, at the top level and inside every nested object both share (`steps`, `aheadBehind`). Run `check-brief.mjs` on the new brief, not on the entry. With the read brief and the new brief in two files:

```sh
node -e 'const fs = require("fs"); const [a, b] = process.argv.slice(1).map((f) => JSON.parse(fs.readFileSync(f, "utf8"))); const obj = (x) => !!x && typeof x === "object" && !Array.isArray(x); const gone = (o, n) => { const out = { ...n }; for (const k in o) if (!(k in n)) out[k] = { __delete__: true }; else if (obj(o[k]) && obj(n[k])) out[k] = gone(o[k], n[k]); return out; }; console.log(JSON.stringify(gone(a, b)))' <read-brief.json> <new-brief.json>
```

- **New lane id**: the lane name slugged the way `docId` slugs a key, with no lane prefix: lowercase, every run of characters outside `a-z0-9` becomes `-`, leading and trailing `-` trimmed, cut to 40 characters (and any `-` the cut leaves at the end dropped), then `-2`, `-3` … while an existing lane id has it:

```sh
node -e 'const [name, ...taken] = process.argv.slice(1); const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, ""); let id = base, n = 2; while (taken.includes(id)) id = base + "-" + n++; console.log(id)' '<lane name>' <existing lane ids…>
```

- **Doc ids**: compare each question with the lane's open docs by `ref`, then by question text; a match is an `update` of that doc. A new doc gets its id from `docId`, with every existing id in `decisions` as taken:

```sh
node --input-type=module -e 'await import("/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.claude/skills/ship-board/lane-core.js"); const [lane, key, ...taken] = process.argv.slice(1); console.log(LaneCore.docId(lane, key, new Set(taken)))' <lane> '<ref or question>' <existing ids…>
```

- **New doc fields**: `lane`, `phase`, `kind`, `question`, `context`, `options`, `recommended`, `askedBy: "orient"`, `askedOn`, `ref`; validated by `validateDecision`.
- **Version failure**: the batch names the stale entry. Re-read that doc, rebuild its entry on the new version (keep the owner's fields), and send the batch once more. A second failure stops the run and is said in the closing line.

## Dry output

One JSON file, passing `check-brief.mjs`:

```json
{
  "lane": "<id>", "laneIsNew": false, "ref": "<ref>", "base": "<base>",
  "brief": { },
  "decisions": [{ "id": "<doc id>", "op": "set|update" }],
  "rulings": [{ "file": "<path in the copy step 2 would write>", "id": "<ruling ID>", "text": "<owner's words>", "date": "<YYYY-MM-DD>" }],
  "decisionPatches": [{ "id": "<doc id>", "patch": { "reply": "", "replyOn": "", "appliedOn": "" } }],
  "lanePatch": { },
  "collisionPairs": [ ]
}
```

`rulings` and `decisionPatches` are what step 2 would write; `decisions` carries each doc's full fields beside `id` and `op`. `lanePatch` is the lane entry exactly as [Board write](#board-write) would send it: `brief` with a `{"__delete__": true}` for each stale key, `briefAt`, and `stage`, `next` or `branch` when changed. `check-brief.mjs` reads the top-level `brief`, never `lanePatch`.

## Speed discipline

- Read: the target's status block; the plan; the spec's decision list (not the whole spec); the tracker's status block, rulings table and open questions (not the whole tracker); the one memory `project-*` file the `MEMORY.md` index marks "READ before" for this area; the roadmap's decisions (its answered `decisions` and `edits` for the node, not the board's `decisions`), via `ArtifactData` on `https://claude.ai/artifact/66odNQKdxqZdN6n5SEPY9n`, only after the target is picked.
- Diffs, not files: `git log`, `git show --stat`, `git diff --stat`, and `git diff <baseline>..<ref> -- <file>` only for a divergence entry whose effect on a requirement is unclear. Never read a named file in full unless no verdict is possible otherwise.
- Big plans are read by their skeleton: for a plan over about 30 KB, read the header, the Global Constraints, and each task's title, **Files** and **Interfaces** blocks only (`grep -n '^### Task\|^- Create:\|^- Modify:\|^- Produces:'` then `sed -n` around the hits); step bodies are read only for a task whose verdict is `partial`.
- The checkpoint makes repeats cheap: when `Verified at` holds a sha (never `—`) and `git rev-parse <ref>` equals it, skip checks 1 and 2 and run check 3 against new rulings only. A block with `Verified at: —` was written by `session-capture`; its `Done` line is a claim, and all three checks run.
- Subagents only above about twelve tasks, at most three in parallel, read-only, each owning a slice of the task list and returning its rows of the task table in the shape above.
- Budget: about two minutes of wall time for the checks on a plan, longer for an epic with several planned children; pull the roadmap only after the checks, and run the collision pairs last. When the budget is spent, the remaining verdicts are `inferred` and `evidence` says which.

## Cold-start ranking

A plan under `docs/superpowers/plans/` or `docs/plans/` is a candidate when any of: its status block's stage is before `shipped` · it has no status block · the newest commit touching a file it names is newer than the newest commit touching the plan file itself.

```sh
git log -1 --format=%cs -- <plan>                       # last plan edit; untracked → stat -c %y <plan>
git log -1 --format=%cs <ref> -- <named files>          # last code movement under it
```

Rank by the gap between the two dates, largest first; cap ten. Show each as `path · stage · last plan edit · last code movement`. Header reads and dates only; this list verifies nothing. A time hint from the owner ("last week") narrows the list to files that moved in that window before ranking.

## Write-back

1. **Ruling IDs.** A ruling row from an applied answer is `| # | Ruling | Date |`, in the owner's words. The ID is the next free one in that table's series, read from the existing rows (`EI-D`, `R`, `K`, `C` …). When the tracker, or a plan with no tracker, has no table, insert `## Rulings` with the three columns right after the status block, continuing from the highest ID of that series found anywhere in the file; never restart at 1.
2. **Status block.** Regenerated from the verified state plus the new rulings, in the shape of the Status block section, in the plan (plan altitude) or the tracker (epic altitude).
3. **Memory.** In the matching `project-*` file, refresh the frontmatter `description` and the first status sentence of the body, and refresh its `MEMORY.md` index line. With no `project-*` file for this area, skip this step and say so; never add a memory file or a `MEMORY.md` line from here.
4. Nothing is committed unless the owner asks, and then only by explicit path.
