# Issue tracker: GitHub

GitHub issues on `OlisDevSpot/tri-pros-website` are the record of all work: every epic, spec, slice, bug and decision. Use the `gh` CLI. `gh` here is 2.67: it has no `--parent` or `--add-sub-issue`, so sub-issues and blocking go through `gh api` as shown.

## Where state lives

| Fact | Home |
|---|---|
| Readiness before work (needs-triage … ready-for-human) | Triage labels, see `docs/agents/triage-labels.md` |
| Claimed | Assignee. Assign first, before any work, so other sessions skip it |
| In flight | Project 3 Status: `In Progress` → `In Review` → `Done` |
| Done | Issue closed (the merged PR closes it; Project 3 sets `Done` by itself) |
| Rejected | Closed as not planned, with `wontfix` |
| Area / priority | `area:*`, `P0`–`P3` labels |

Project 3 Status has no Backlog or Ready: an open issue with no Status is not in flight. Never write readiness into Status or flight into labels.

## Conventions

- **Create**: `gh issue create --title "..." --body-file <file> --label needs-triage --label <bug|enhancement|refactor|chore>` (heredoc or file for multi-line bodies). Every new issue starts as `needs-triage` plus one category; an epic takes `epic` instead of `needs-triage`. On GitHub itself, the Bug, Feature and Epic issue forms apply the same labels.
- **Read**: `gh issue view <n> --json number,title,body,labels,assignees,comments`.
- **List**: `gh issue list --state open --json number,title,labels,assignees --limit 200` with `--label` filters.
- **Comment**: `gh issue comment <n> --body-file <file>`.
- **Labels**: `gh issue edit <n> --add-label "..." --remove-label "..."`.
- **Close done**: `gh issue close <n> --comment "..."`. **Close rejected**: `gh issue close <n> --reason "not planned" --comment "..."` and add `wontfix`.
- **Claim**: `gh issue edit <n> --add-assignee @me`.
- **Database id** (needed by sub-issue and blocking calls, not the `#number`): `gh api repos/OlisDevSpot/tri-pros-website/issues/<n> --jq .id`.

## Specs live in the issue body

A spec is the body of its issue, never a file under `docs/`.

- The work already has an issue: rewrite its body as the spec and keep the original request under a final `## Original request` heading.
- It has none: create one with the spec as the body.

Skills that say "publish the spec to the issue tracker" follow this.

## Epics and sub-issues

An epic is an issue labelled `epic` whose slices are native sub-issues.

```bash
child_id=$(gh api repos/OlisDevSpot/tri-pros-website/issues/<child> --jq .id)
gh api --method POST repos/OlisDevSpot/tri-pros-website/issues/<parent>/sub_issues -F sub_issue_id="$child_id"
gh api repos/OlisDevSpot/tri-pros-website/issues/<parent>/sub_issues --jq '.[] | "#\(.number) \(.title)"'
```

Use `-F`, not `-f`: the id must be sent as an integer or the API returns 422. Never close or rewrite a parent when adding children.

## Blocking

Native issue dependencies, visible in GitHub's UI.

```bash
blocker_id=$(gh api repos/OlisDevSpot/tri-pros-website/issues/<blocker> --jq .id)
gh api --method POST repos/OlisDevSpot/tri-pros-website/issues/<blocked>/dependencies/blocked_by -F issue_id="$blocker_id"
gh api repos/OlisDevSpot/tri-pros-website/issues/<n> --jq .issue_dependencies_summary.blocked_by   # open blockers
```

An issue is unblocked when `blocked_by` is 0. Create every issue first, then wire edges in a second pass with real numbers: a placeholder `#<n>` links to an unrelated issue.

## Slice readiness

`/to-tickets` labels every slice `ready-for-agent` by default. Here each slice is rated instead (owner 2026-11-23):

- The slice body ends with `**Confidence: N/10**` and one line on why: how sure a fresh session can build it from the body alone, against the epic's spec.
- 8/10 or higher: `ready-for-agent`. Below: `needs-info`, with the open questions under `## Open questions` in the body.
- A `needs-info` slice is shaped before its lane opens: `/grill-with-docs #n` against the epic's spec, `/to-spec #n` (rewrites its body, sets `ready-for-agent`), `/stress-test-plan`.
- The owner can move any slice either way when approving the breakdown.

## Project 3 Status (in flight only)

```bash
item=$(gh project item-add 3 --owner OlisDevSpot --url <issue-url> --format json --jq .id)
read -r field opt < <(gh project field-list 3 --owner OlisDevSpot --format json \
  --jq '.fields[] | select(.name=="Status") | "\(.id) \(.options[] | select(.name=="In Progress") | .id)"')
gh project item-edit --id "$item" --project-id PVT_kwHOCqZfGM4BSgDZ --field-id "$field" --single-select-option-id "$opt"
```

Look option ids up by name as above; don't hard-code them. `item-add` returns the existing item when the issue is already on the board.

- Claimed and work starts: `In Progress`. The "Pull request linked to issue" automation also sets `In Progress`, so opening a draft PR leaves it there.
- PR ready for the owner: `In Review`, set by hand (later `/ship-lane`); nothing else moves it there.
- Merged with `Closes`: nothing to do; closing sets `Done`.
- Merged with `Refs` (the lane keeps going): set it back to `In Progress`.

## Branches and PRs

- Branch: `{feat|fix|refactor|chore|docs}/<issue-number>-<slug>`. The number in the branch is how a session finds its issue and its ship-board row.
- PR body carries `Closes #<n>` for every issue it finishes, so merging closes them. A PR that ships part of a lane that keeps going carries `Refs #<n>` instead, and the issue stays open.

## What each stage writes

The flow's stages are listed in `CLAUDE.md` (GitHub workflow). Each one keeps the issue in step:

| Stage | GitHub write |
|---|---|
| Capture and triage | Issue created as `needs-triage` + category. `/triage` sets the readiness label; a small issue gets an agent brief comment |
| Shape | `/to-spec` rewrites the body as the spec (original under `## Original request`) and sets `ready-for-agent`. An epic is shaped once as a whole; a `needs-info` slice is shaped the same way against its epic's spec. `/wayfinder` opens a map issue instead |
| Slice | `/to-tickets` opens one sub-issue per slice with `blocked_by` links, each rated and labelled as in **Slice readiness** |
| Open the lane | Assignee; Status `In Progress`; branch `{type}/{n}-{slug}` |
| Build | Comments at milestones only. Draft PR with `Closes #n` or `Refs #n` |
| Verify, PR | Status `In Review`. The "what to check" list goes on the PR |
| Review | The owner's notes on the PR or preview; each decision copied to the issue as a comment. Approach rejected: PR back to draft with a comment saying why |
| Merge | Automatic: `Closes` closes the issue and sets `Done` |
| Catch up | Confirm the issue closed (after a `Refs` merge, Status back to `In Progress`); check the epic's sub-issue progress; report issues whose `blocked_by` reached 0 |
| Learn | Each `/retro` finding becomes a guard in the lane's PR or a `chore` issue labelled `needs-triage` |

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

## When a skill says "publish to the issue tracker"

Create a GitHub issue as above, or write into the work's existing issue when one exists.

## When a skill says "fetch the relevant ticket"

Read it as in **Read** above.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: one issue labelled `wayfinder:map`, holding Destination / Notes / Decisions so far / Not yet specified / Out of scope.
- **Child ticket**: a native sub-issue of the map (see **Epics and sub-issues**), labelled `wayfinder:<research|prototype|grilling|task>` and nothing else. Maps and their tickets carry no triage labels and no Project 3 Status.
- **Blocking**: native dependencies (see **Blocking**).
- **Frontier**: the map's open sub-issues with `blocked_by` 0 and no assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve**: comment the answer, close the ticket, append a one-line gist + link to the map's Decisions so far.
