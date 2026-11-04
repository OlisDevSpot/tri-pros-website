# Orient reference

The shapes and rules `SKILL.md` cites. Section names are stable; the skill links them by heading.

## Status block

Every tracker and every plan carries this block directly under its title, replacing the old `> **Status:**` paragraph the first time `/orient` or `session-capture` touches the file. The `> **Goal:**` and `> **Design:**` lines beside it stay. Files not yet touched keep their paragraph; there is no migration sweep.

```md
> **Status**
> - Stage: plan · stress-tested 2026-10-22
> - Built on: `feat/proposal-energy-impact` · Verified at: `feat/proposal-energy-impact@abc1234` (2026-11-03) · page: https://claude.ai/artifact/…
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
| `Verified at` | `ref@sha (date)` of the last `/orient` run; the next run's baseline |
| `page` | the artifact URL; or a local path followed by `(local)` when the session had no Artifact tool |
| `Done` | task or phase IDs that are `done`, in order |
| `Next` | the ordered next steps, with the dependency in brackets when one step must precede another |
| `Open` | question IDs and blockers waiting on the owner or another plan |
| `Blocked` | what cannot move and on what, or `none` |

Which block is the checkpoint: the tracker's block for epic altitude, the plan's own block for plan altitude. A plan-altitude run never rewrites the tracker's `Verified at`; it rewrites the tracker's `Done`, `Next`, `Open` and `Blocked` only when the run changed them through rulings.

Stage meanings: `brainstorm` = grilled, no design doc · `spec` = design written or approved, no plan · `plan` = plan written, nothing built · `building` = tasks in progress on a ref · `built` = every task `done` on the named ref but not on `origin/main` · `shipped` = reachable from `origin/main`.

## Checks

Always all three, never deeper. One named ref per run: the block's `Built on`, else the branch the tracker names for that plan, else the current worktree's HEAD. No checkout; another session's worktree is never entered.

**Baseline**, first that applies: the block's `Verified at` sha · the tracker's `Baseline` line · the plan file's first commit (`git log --diff-filter=A --format=%h -- <plan>`) · for an untracked plan, the oldest commit touching any named file on or after the date in the plan's filename: `git log --reverse --format='%h %cs' <ref> -- <files>` and take the first row whose date is on or after that date (`--since` stops at an older interleaved commit and mis-reports). A baseline sha that is not an ancestor of the ref (`git merge-base --is-ancestor <sha> <ref>` fails; a squash merge happened) falls through to the next rung, and the page says so.

### 1. Tasks against the tree

For each `### Task N` in the plan, take the paths under **Files** and the names under **Interfaces › Produces** (tables, columns, DAL functions, procedures, hooks, components, constants).

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

Evidence column: `path` · `file:line` of the grep hit · `sha`. Checkboxes in the plan are read, never trusted.

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
| `invalidated` | a newer ruling (tracker, memory, roadmap `decisions`) or a shipped change contradicts it; cite which |

Judge from the divergence list's diffs and the rulings, not from re-reading the named files.

**Tags.** Every verdict in all three checks is `verified` (a path, grep hit or commit was seen in this run) or `inferred` (judged from names, messages or status lines). A verdict the run cannot verify inside the budget is tagged `inferred`, not researched further.

## Speed discipline

- Read: the target's status block; the plan; the spec's decision list (not the whole spec); the tracker's status block, rulings table and open questions (not the whole tracker); the one memory `project-*` file the `MEMORY.md` index marks "READ before" for this area; the roadmap's answered `decisions` and `edits` for the node, via `ArtifactData` on `https://claude.ai/artifact/66odNQKdxqZdN6n5SEPY9n`, only after the target is picked.
- Diffs, not files: `git log`, `git show --stat`, `git diff --stat`, and `git diff <baseline>..<ref> -- <file>` only for a divergence entry whose effect on a requirement is unclear. Never read a named file in full unless no verdict is possible otherwise.
- The checkpoint makes repeats cheap: when `git rev-parse <ref>` equals the `Verified at` sha, skip checks 1 and 2 and run check 3 against new rulings only.
- Subagents only above about twelve tasks, at most three in parallel, read-only, each owning a slice of the task list and returning its rows of the task table in the shape above.
- Budget: about two minutes of wall time for a plan, longer for an epic with several planned children. When the budget is spent, the remaining verdicts are `inferred` and the page says which.

## Cold-start ranking

A plan under `docs/superpowers/plans/` or `docs/plans/` is a candidate when any of: its status block's stage is before `shipped` · it has no status block · the newest commit touching a file it names is newer than the newest commit touching the plan file itself.

```sh
git log -1 --format=%cs -- <plan>                       # last plan edit; untracked → stat -c %y <plan>
git log -1 --format=%cs <ref> -- <named files>          # last code movement under it
```

Rank by the gap between the two dates, largest first; cap ten. Show each as `path · stage · last plan edit · last code movement`. Header reads and dates only; this list verifies nothing. A time hint from the owner ("last week") narrows the list to files that moved in that window before ranking.

## Decision sheet

At most four items, each from one of the four categories, in this order of preference:

1. **Next step and order**: which task or child runs next, and what it must wait for.
2. **Stale task**: re-planned or dropped.
3. **Invalidated requirement**: retired or re-argued.
4. **Siblings and children** (epic altitude): which children run next, in parallel or in sequence.

Each item is one `AskUserQuestion` call: the question, two to four real options, the cost or the unblock of each option in its description, the recommended option first. Anything the code can settle is settled by the skill and listed under **Claude's calls** before the sheet, never asked. Housekeeping (committing, deleting or moving docs) is not an item; it goes under Claude's calls or `Open`.

## Write-back

In this order, after the last answer:

1. **Rulings.** One dated row per answer, in the owner's words, in the tracker's rulings table (`| # | Ruling | Date |`). The ID is the next free one in that table's series, read from the existing rows (`EI-D`, `R`, `K`, `C` …). When the tracker, or a plan with no tracker, has no table, insert `## Rulings` with the three columns right after the status block, continuing from the highest ID of that series found anywhere in the file; never restart at 1.
2. **Status block.** Regenerated from the verified state plus the new rulings, in the shape of §Status block, in the plan (plan altitude) or the tracker (epic altitude).
3. **Memory.** Refresh the one-line status in the matching `project-*` file and its `MEMORY.md` index line; no new memory file.
4. **One line in chat** saying what changed, then stop. Nothing is committed unless the owner asks, and then only by explicit path.

## Pages

One page per plan or epic, republished to the **same URL** each run; the URL lives in the status block. Built from the visual-explainer kit with the generic renderer, not the claim-tree plan page.

```sh
cp .claude/skills/orient/templates/<plan|epic>-page.src.html ~/.agent/diagrams/orient-<slug>.src.html   # then fill the {{…}} tokens
node ~/.claude/skills/visual-explainer/kit/render.mjs ~/.agent/diagrams/orient-<slug>.src.html -o ~/.agent/diagrams/orient-<slug>.html   # writes, then looks once; fix every ✗ it prints and render again (`--lint` only checks and writes nothing)
```

Publish the rendered file with the Artifact tool: to the block's URL when it has one, else as a new artifact (icon `map`, title `Orient · <plan or epic>`). Without the Artifact tool, open the local rendered file and write its path in the block followed by `(local)`.

**Plan page**, one screen, section ids in order:

| id | Content |
|---|---|
| header | eyebrow = the epic (or `standalone`), h1 = the plan, lead = two sentences of what and why from the spec, meta = `stage · verified ref@sha date` |
| `stage` | the six stages as a ribbon, the current one lit, with its date |
| `tasks` | one chip per task, class by verdict (`ok` done, `warn` partial or stale, `risk` not started), `title` = the evidence |
| `decided` | rulings and requirement IDs that `still hold`, newest first |
| `open` | open questions and blockers |
| `stale` | `holds, path stale` and `invalidated` IDs, and the divergence list with shas |
| `sheet` | the decision items as `<ve-ask>` blocks with a visible note "answer in the session" |

**Epic page**, one screen:

| id | Content |
|---|---|
| header | h1 = the epic, lead and meta as above |
| `lanes` | three lanes, Done · In flight · Ahead, one card per child with its stage chip and one-line verified state |
| `relations` | a `<ve-flow>` of children with `blocks` edges and a boundary around the parallel-safe group |
| `sheet` | as above |

Fit: no scrolling at 1440×900; text is caption, not content. Detail that does not fit goes in the status block, not on the page.
