# GitHub Workflow Pipeline — Design Spec

**Date:** 2026-03-22
**Status:** Approved
**Branch:** TBD (setup from `main`)

---

## Problem

Work is tracked in `docs/tasks/TASKS.md` and Claude Memory — both are manual, lack visibility, and don't support a formal review process. There's no structured way for Claude agents to autonomously pick up, execute, and deliver work. Context is lost between sessions, there's no dashboard view, and code lands on `main` without a review gate.

## Solution

A GitHub-native workflow pipeline using Issues, Projects, PRs, and Labels that gives:

1. **Visibility** — A kanban board showing all work at a glance
2. **Traceability** — Every change links Issue -> Branch -> PR -> Merge
3. **Review gate** — Claude self-reviews before opening PRs; you approve before merge
4. **Agent autonomy** — Claude agents pick up labeled issues, work in isolation, deliver PRs
5. **Awareness** — `claude:*` labels and GitHub notifications keep you informed without babysitting

## Architecture

### The Pipeline

```
You create Issue -> Claude picks up (claude:ready) ->
Claude creates branch -> Claude works -> Claude self-reviews ->
Claude opens PR (links issue) -> CI runs (lint + build) ->
You review -> You merge -> Issue auto-closes -> Card moves to Done
```

### Components

| Component | Purpose |
|---|---|
| GitHub Issues | Task tickets — replace TASKS.md as source of truth |
| GitHub Labels | Categorization — area, priority, type, workflow status |
| GitHub Projects (kanban) | Dashboard — visual board of all work |
| GitHub Branches | Isolation — each issue gets its own branch |
| GitHub Pull Requests | Review gate — diff, description, CI checks, approval |
| GitHub Actions (CI) | Automated checks — lint + build on every PR |

---

## Label System

Three dimensions plus workflow labels. Each issue gets one label from each category.

### Area Labels (primary — maps to agent personas)

| Label | Color | Hex | Dispatches To | Examples |
|---|---|---|---|---|
| `area:frontend` | blue | `#1d76db` | Frontend Developer, UI Designer | Components, pages, styling, responsive |
| `area:backend` | green | `#0e8a16` | Backend Architect, Data Engineer | tRPC routers, DAL, schema, migrations |
| `area:infrastructure` | red | `#d93f0b` | DevOps Automator, SRE | CI/CD, deployment, env config |
| `area:sales-flow` | yellow | `#e4e669` | Domain-specific (Frontend + Backend) | Proposals, intake, pipeline, meetings |
| `area:integrations` | light blue | `#c5def5` | Backend + relevant service | DocuSign, R2, Notion, Resend, Meta |
| `area:showroom` | periwinkle | `#bfd4f2` | Frontend + Backend | Portfolio, project showcase, media |

### Priority Labels

| Label | Color | Hex | Meaning |
|---|---|---|---|
| `P0` | dark red | `#b60205` | Urgent — blocks revenue or users |
| `P1` | orange | `#d93f0b` | Important — do this sprint |
| `P2` | yellow | `#fbca04` | Nice to have — do when bandwidth allows |
| `P3` | green | `#0e8a16` | Backlog — someday |

### Type Labels

| Label | Color | Hex | Meaning |
|---|---|---|---|
| `type:feature` | teal | `#a2eeef` | New capability |
| `type:bug` | red | `#d73a4a` | Something is broken |
| `type:refactor` | purple | `#d4c5f9` | Restructure without behavior change |
| `type:chore` | gray | `#ededed` | Maintenance, deps, config |

### Workflow Labels

| Label | Color | Hex | Meaning |
|---|---|---|---|
| `claude:ready` | bright green | `#00ff00` | Fully specified — Claude can pick this up |
| `claude:blocked` | orange | `#ffa500` | Claude proposed this but needs your input/decision |
| `claude:in-progress` | blue | `#1d76db` | Claude is actively working on this |

---

## Project Board

**Project name:** Tri Pros Development

### Columns

| Column | What lives here | How cards arrive |
|---|---|---|
| Backlog | Future work, ideas, low-priority items | Default for new issues |
| Ready | Fully specified, labeled `claude:ready` | You move here when ready to work |
| In Progress | Currently being worked on (1-2 max) | Claude moves here when starting |
| In Review | PR is open, waiting for your review | Auto-moves when PR is opened |
| Done | Merged and closed | Auto-moves when PR merges |

**WIP limit:** In Progress column should have at most 2 items at a time.

### Board Automation (configured in GitHub UI)

GitHub Projects v2 requires manual configuration of these automations in the project settings:

| Trigger | Action |
|---|---|
| Issue added to project | Set status to "Backlog" |
| PR linked to issue is opened | Move card to "In Review" |
| PR linked to issue is merged | Move card to "Done" |
| Issue closed (not via PR) | Move card to "Done" |

These are configured via **Project Settings > Workflows** in the GitHub UI after the board is created.

---

## Branch Naming Convention

```
{type}/{issue-number}-{short-description}
```

Type prefixes map to type labels:
- `feat/` — `type:feature`
- `fix/` — `type:bug`
- `refactor/` — `type:refactor`
- `chore/` — `type:chore`

Examples:
- `feat/23-notion-crm-migration`
- `fix/31-proposal-access-control`
- `refactor/28-extract-trade-scope-row`
- `chore/35-update-dependencies`

---

## PR Template

Every PR follows this structure:

```markdown
## Summary
What this PR does and why (2-3 sentences).

Closes #<issue-number>

## Changes
- Bullet list of what was modified

## Self-Review
Claude's own review of the code:
- [ ] Lint passes (`pnpm lint`)
- [ ] Build passes (`pnpm build`)
- [ ] Coding conventions followed (one component per file, named exports, etc.)
- Concerns or trade-offs noted
- Areas that need human attention flagged

## Test Plan
How to verify this works (manual steps or test commands)
```

The `Closes #<issue-number>` line auto-closes the linked issue when the PR merges.

---

## CI Workflow

A single GitHub Actions workflow that runs on every PR to `main`:

```yaml
name: PR Checks

on:
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    env:
      # Build-time env vars (dummy values — these are only needed for
      # Next.js to compile, not for runtime functionality)
      NEXT_PUBLIC_BASE_URL: "https://ci.example.com"
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: ""
      # All server-side vars use .env.ci stub (see below)
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: cp .env.ci .env
      - run: pnpm lint
      - run: pnpm build
```

### CI Environment Strategy

The app's `server-env.ts` calls `process.exit(1)` if any env var is missing. All ~30 vars are validated at import time, but most are only **used** at runtime (DocuSign, Pipedrive, Monday, Notion, R2, etc.). The build just needs them to exist.

**Approach:** A committed `.env.ci` stub file with dummy/placeholder values for all required vars. This lets `pnpm build` pass without exposing real secrets.

- `.env.ci` contains dummy strings like `ci_placeholder` for every required var
- The CI step copies `.env.ci` to `.env` before building
- `NEXT_PUBLIC_*` vars that affect build output are set in the workflow `env:` block
- Real secrets are never committed — `.env` stays in `.gitignore`

**Prerequisite:** `pnpm-lock.yaml` must be committed (confirmed: it is).

### Existing Workflow Replacement

The existing `.github/workflows/base.yml` uses npm, Node 16, and `actions/checkout@v5` — it is outdated and will be **deleted and replaced** by this new workflow. The new workflow triggers on `pull_request` to `main` only. A post-merge build check on `push` to `main` can be added later if needed.

---

## Agent Workflow

### Picking Up Work

1. Claude reads the board, finds an issue labeled `claude:ready` in the "Ready" column
2. Changes label from `claude:ready` to `claude:in-progress` (removes `claude:ready`)
3. Reads the issue description + any linked spec/context files
4. Uses the area label to activate the right agent persona(s)

### Working

1. Creates a branch following the naming convention: `{type}/{issue-number}-{short-description}`
2. Works through the implementation with focused, conventional commits
3. Commits follow existing style: `feat(scope): description`, `fix(scope): description`, etc.

### Self-Review

Before opening the PR, Claude:
1. Runs `pnpm lint` and `pnpm build` locally
2. Reviews its own diff for code quality, convention violations, security concerns
3. Notes trade-offs, uncertainties, or areas needing human attention
4. Uses the `superpowers:requesting-code-review` skill for thorough self-assessment

### Opening the PR

1. Opens PR using the template above
2. Links the issue with `Closes #<number>`
3. Removes `claude:in-progress` label (PR itself signals active work now)
4. CI runs automatically
5. Card moves to "In Review" on the board

### Your Review

You receive a GitHub notification. You:
- Read the summary and self-review notes
- Check the diff
- **Approve and merge**, **request changes** (comment), or **close** (wrong approach)

### Iteration

If you request changes:
1. Claude reads your review comments
2. Pushes fixes to the same branch
3. Updates PR description if needed
4. CI re-runs

### Merge & Cleanup

You merge the PR. GitHub automatically:
- Closes the linked issue
- Moves the card to "Done"
- Branch can be deleted (GitHub offers a button)

### Claude Proposing New Issues

When Claude discovers a bug, tech debt, or follow-up during work:
1. Creates a new issue with appropriate area + type + priority labels
2. Adds the `claude:blocked` label (meaning: needs your prioritization)
3. You review, adjust labels, and move to "Ready" when you agree

---

## Migration Plan: TASKS.md -> GitHub Issues

The existing `docs/tasks/TASKS.md` backlog will be migrated to GitHub Issues:

| TASKS.md Status | GitHub Destination |
|---|---|
| Ready to Execute | Issue in "Ready" column, labeled `claude:ready` |
| Blocked | Issue in "Backlog" column, labeled `claude:blocked` |
| Partially Done | Issue in "Backlog" column with status note in description |
| Not Started | Issue in "Backlog" column |
| Completed | Skip — already done |

Each migrated issue follows this format:
- **Title:** The task name from TASKS.md (e.g., "Notion CRM Migration")
- **Body:** The one-liner description + link to context file + any blocked-by references as `Depends on #<issue-number>`
- **Labels:** Appropriate area + priority + type labels

After migration, `TASKS.md` becomes a redirect: "See the GitHub Project board at [link]".

---

## CLAUDE.md Updates

The project `CLAUDE.md` will be updated with a new section:

```markdown
## GitHub Workflow

### Branch Convention
{type}/{issue-number}-{short-description}
Types: feat, fix, refactor, chore

### PR Process
1. Create branch from main
2. Work + commit (conventional commits)
3. Self-review: run lint + build, review diff
4. Open PR with template (Summary, Changes, Self-Review, Test Plan)
5. Link issue with "Closes #N"
6. Wait for CI + human review

### Labels
- Area: area:frontend, area:backend, area:infrastructure, area:sales-flow, area:integrations, area:showroom
- Priority: P0, P1, P2, P3
- Type: type:feature, type:bug, type:refactor, type:chore
- Workflow: claude:ready, claude:blocked, claude:in-progress
```

---

## What This Does NOT Include (Future Enhancements)

- **Auto-assignment via GitHub Actions** — Could auto-assign Claude when `claude:ready` is applied
- **PR review bots** — Automated code review beyond Claude's self-review
- **Test suite in CI** — Add when test coverage grows
- **Release management** — Tags, changelogs, semantic versioning
- **Multiple project boards** — One board is sufficient for current scale
- **Branch protection rules** — Require PR reviews / passing CI before merge. Add when workflow is proven.

---

## Implementation Sequence

1. Authenticate `gh` CLI
2. Create all labels on the repo (delete GitHub defaults first)
3. Create the GitHub Project board with columns
4. Configure board automation workflows (in GitHub UI)
5. Create the PR template file (`.github/pull_request_template.md`)
6. Create `.env.ci` stub file with dummy values for all required env vars
7. Replace `.github/workflows/base.yml` with new PR Checks workflow
8. Migrate TASKS.md items to GitHub Issues (with structured body format)
9. Add issues to the Project board in correct columns
10. Update CLAUDE.md with workflow conventions
11. Update Claude Memory with workflow reference
