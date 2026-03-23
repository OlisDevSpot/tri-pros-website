# GitHub Workflow Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up a GitHub-native workflow pipeline (Issues, Labels, Projects, PRs, CI) so Claude agents can autonomously pick up, execute, and deliver work through a structured review process.

**Architecture:** GitHub Issues replace TASKS.md as the task system. A kanban Project board provides visibility. PRs with CI checks (lint + build) are the review gate. Labels categorize work by area/priority/type and signal agent workflow status.

**Tech Stack:** GitHub CLI (`gh`), GitHub Actions, GitHub Projects v2

**Repo:** `OlisDevSpot/tri-pros-website`

**Note:** Tasks 4-6 and 9-11 commit infrastructure directly to `main`. This is intentional — we need the CI workflow and PR template to exist before we can use the PR-based workflow. Once setup is complete, all future work follows the Issue → Branch → PR pipeline.

---

## Task 1: Authenticate GitHub CLI

**Files:** None (CLI configuration only)

**Prerequisites:** User must have a GitHub account with access to `OlisDevSpot/tri-pros-website`.

- [ ] **Step 1: Check if gh is installed**

Run: `gh --version`
Expected: Version output (e.g., `gh version 2.x.x`)
If missing: `sudo apt install gh` or follow https://cli.github.com/

- [ ] **Step 2: Authenticate gh**

Run: `gh auth login`
Follow the interactive prompts:
- Select `GitHub.com`
- Select `HTTPS`
- Select `Login with a web browser`
- Copy the one-time code, open the URL in browser, paste code, authorize

- [ ] **Step 3: Verify authentication**

Run: `gh repo view OlisDevSpot/tri-pros-website --json name,owner`
Expected: `{"name":"tri-pros-website","owner":{"login":"OlisDevSpot"}}`

- [ ] **Step 4: Verify issue/PR permissions**

Run: `gh api repos/OlisDevSpot/tri-pros-website --jq '.permissions'`
Expected: `{"admin":true,"push":true,"pull":true}` (or similar with admin/push access)

---

## Task 2: Create Label System

**Files:** None (GitHub API only)

- [ ] **Step 1: Delete GitHub default labels**

GitHub repos come with default labels (bug, documentation, duplicate, enhancement, etc.) that conflict with our system. Delete them all:

```bash
gh label list --repo OlisDevSpot/tri-pros-website --json name --jq '.[].name' | while read -r label; do
  gh label delete "$label" --repo OlisDevSpot/tri-pros-website --yes
done
```

Expected: All default labels removed.

- [ ] **Step 2: Create area labels**

```bash
gh label create "area:frontend" --color "1d76db" --description "Components, pages, styling, responsive" --repo OlisDevSpot/tri-pros-website
gh label create "area:backend" --color "0e8a16" --description "tRPC routers, DAL, schema, migrations" --repo OlisDevSpot/tri-pros-website
gh label create "area:infrastructure" --color "d93f0b" --description "CI/CD, deployment, env config" --repo OlisDevSpot/tri-pros-website
gh label create "area:sales-flow" --color "e4e669" --description "Proposals, intake, pipeline, meetings" --repo OlisDevSpot/tri-pros-website
gh label create "area:integrations" --color "c5def5" --description "DocuSign, R2, Notion, Resend, Meta" --repo OlisDevSpot/tri-pros-website
gh label create "area:showroom" --color "bfd4f2" --description "Portfolio, project showcase, media" --repo OlisDevSpot/tri-pros-website
```

- [ ] **Step 3: Create priority labels**

```bash
gh label create "P0" --color "b60205" --description "Urgent — blocks revenue or users" --repo OlisDevSpot/tri-pros-website
gh label create "P1" --color "d93f0b" --description "Important — do this sprint" --repo OlisDevSpot/tri-pros-website
gh label create "P2" --color "fbca04" --description "Nice to have — do when bandwidth allows" --repo OlisDevSpot/tri-pros-website
gh label create "P3" --color "0e8a16" --description "Backlog — someday" --repo OlisDevSpot/tri-pros-website
```

- [ ] **Step 4: Create type labels**

```bash
gh label create "type:feature" --color "a2eeef" --description "New capability" --repo OlisDevSpot/tri-pros-website
gh label create "type:bug" --color "d73a4a" --description "Something is broken" --repo OlisDevSpot/tri-pros-website
gh label create "type:refactor" --color "d4c5f9" --description "Restructure without behavior change" --repo OlisDevSpot/tri-pros-website
gh label create "type:chore" --color "ededed" --description "Maintenance, deps, config" --repo OlisDevSpot/tri-pros-website
```

- [ ] **Step 5: Create workflow labels**

```bash
gh label create "claude:ready" --color "00ff00" --description "Fully specified — Claude can pick this up" --repo OlisDevSpot/tri-pros-website
gh label create "claude:blocked" --color "ffa500" --description "Claude proposed this — needs your input/decision" --repo OlisDevSpot/tri-pros-website
gh label create "claude:in-progress" --color "1d76db" --description "Claude is actively working on this" --repo OlisDevSpot/tri-pros-website
```

- [ ] **Step 6: Verify all labels exist**

Run: `gh label list --repo OlisDevSpot/tri-pros-website`
Expected: 17 labels total (6 area + 4 priority + 4 type + 3 workflow)

---

## Task 3: Create GitHub Project Board

**Files:** None (GitHub API only)

- [ ] **Step 1: Create the project**

```bash
gh project create --owner OlisDevSpot --title "Tri Pros Development"
```

Note the returned project URL — extract the project number from it. Store it:
```bash
PROJECT_NUM=$(gh project list --owner OlisDevSpot --format json --jq '.[] | select(.title=="Tri Pros Development") | .number')
echo "Project number: $PROJECT_NUM"
```

- [ ] **Step 2: Add the Status field options**

GitHub Projects v2 creates a default "Status" field. We need to configure its options to match our columns: Backlog, Ready, In Progress, In Review, Done.

```bash
# Get the project ID
PROJECT_ID=$(gh project list --owner OlisDevSpot --format json --jq '.[] | select(.title=="Tri Pros Development") | .id')
echo "Project ID: $PROJECT_ID"

# List current status field options
gh project field-list $PROJECT_NUM --owner OlisDevSpot --format json
```

Then edit the Status field via the GitHub web UI at:
`https://github.com/orgs/OlisDevSpot/projects/<number>/settings`

Or if this is a user project (not org):
`https://github.com/users/OlisDevSpot/projects/<number>/settings`

Set the Status field options to:
1. Backlog
2. Ready
3. In Progress
4. In Review
5. Done

- [ ] **Step 3: Configure board automations**

In the GitHub UI, go to the project **Settings > Workflows** and enable:

| Workflow | Trigger | Action |
|---|---|---|
| Item added to project | When issue is added | Set status to "Backlog" |
| Pull request merged | When PR is merged | Set status to "Done" |
| Item closed | When issue is closed | Set status to "Done" |
| Item reopened | When issue is reopened | Set status to "Backlog" |

Note: The "PR opened -> In Review" automation is not built-in to GitHub Projects. Cards will need to be moved manually or via the PR description linking. This is acceptable for the initial setup.

- [ ] **Step 4: Set board view to Kanban**

In the GitHub UI, click the view dropdown and select "Board". The board should now show columns matching the Status field options.

- [ ] **Step 5: Verify the board**

Open the project board URL in the browser and confirm:
- 5 columns visible: Backlog, Ready, In Progress, In Review, Done
- Automations are configured
- Board view is selected

---

## Task 4: Create PR Template

**Files:**
- Create: `.github/pull_request_template.md`

- [ ] **Step 1: Create the PR template file**

```bash
ls .github/
```

Verify `.github/` directory exists (it does — `workflows/` is already there).

- [ ] **Step 2: Write the PR template**

Create `.github/pull_request_template.md` with this content:

```markdown
## Summary
<!-- What this PR does and why (2-3 sentences) -->

Closes #<!-- issue number -->

## Changes
<!-- Bullet list of what was modified -->
-

## Self-Review
<!-- Claude's own review of the code -->
- [ ] Lint passes (`pnpm lint`)
- [ ] Build passes (`pnpm build`)
- [ ] Coding conventions followed (one component per file, named exports, etc.)

**Concerns / trade-offs:**
<!-- Note any concerns, trade-offs, or areas needing human attention -->

## Test Plan
<!-- How to verify this works — manual steps or test commands -->
```

- [ ] **Step 3: Commit**

```bash
git add .github/pull_request_template.md
git commit -m "chore: add PR template for GitHub workflow pipeline"
```

---

## Task 5: Create CI Environment Stub

**Files:**
- Create: `.env.ci`
- Modify: `.gitignore`

- [ ] **Step 1: Add .env.ci exception to .gitignore**

The `.gitignore` has `.env*` which would exclude `.env.ci`. Add an exception line immediately after:

Find in `.gitignore`:
```
.env*
```
Add after it:
```
!.env.ci
```

- [ ] **Step 2: Create the .env.ci stub file**

Create `.env.ci` with dummy placeholder values for every required env var from `server-env.ts`. These are NOT real secrets — just placeholders so the build passes validation.

```env
# CI Environment Stub
# Dummy values for build-time validation only — NOT real credentials.
# The app validates all env vars at import time (server-env.ts).
# This file lets pnpm build pass in CI without exposing secrets.

# General
NODE_ENV=production
NEXT_PUBLIC_BASE_URL=https://ci.example.com
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=

# Database
DATABASE_URL=postgresql://ci:ci@localhost:5432/ci

# Better Auth
BETTER_AUTH_SECRET=ci_placeholder_secret_32_chars_xx

# Google
GOOGLE_CLIENT_ID=ci_placeholder
GOOGLE_CLIENT_SECRET=ci_placeholder

# Resend
RESEND_API_KEY=ci_placeholder

# Monday
MONDAY_API_TOKEN=ci_placeholder

# Pipedrive
PIPEDRIVE_BASE_URL=https://ci.pipedrive.com
PIPEDRIVE_API_KEY=ci_placeholder

# DocuSign
DS_USER_ID=ci_placeholder
DS_ACCOUNT_ID=ci_placeholder
DS_INTEGRATION_KEY=ci_placeholder
DS_JWT_PRIVATE_KEY_PATH=ci_placeholder
DS_JWT_PRIVATE_KEY=ci_placeholder

# Notion
NOTION_API_KEY=ci_placeholder

# Cloudflare R2
R2_ACCOUNT_ID=ci_placeholder
R2_TOKEN=ci_placeholder
R2_ACCESS_KEY_ID=ci_placeholder
R2_SECRET_ACCESS_KEY=ci_placeholder
R2_JURISDICTION=ci_placeholder

# Upstash
QSTASH_URL=https://ci.qstash.example.com
QSTASH_TOKEN=ci_placeholder
QSTASH_CURRENT_SIGNING_KEY=ci_placeholder
QSTASH_NEXT_SIGNING_KEY=ci_placeholder
UPSTASH_REDIS_REST_URL=https://ci.redis.example.com
UPSTASH_REDIS_REST_TOKEN=ci_placeholder
```

- [ ] **Step 3: Verify the stub covers all required vars**

Cross-reference with `src/shared/config/server-env.ts`. Every non-optional, non-defaulted field must have a value in `.env.ci`. Optional fields (`BETTER_AUTH_URL`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `DS_DEV_USER_ID`) can be omitted.

- [ ] **Step 4: Commit**

```bash
git add .env.ci .gitignore
git commit -m "chore: add .env.ci stub for CI builds"
```

---

## Task 6: Replace CI Workflow

**Files:**
- Delete: `.github/workflows/base.yml`
- Create: `.github/workflows/pr-checks.yml`

- [ ] **Step 1: Delete the old workflow**

```bash
rm .github/workflows/base.yml
```

- [ ] **Step 2: Create the new PR Checks workflow**

Create `.github/workflows/pr-checks.yml`:

```yaml
name: PR Checks

on:
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Copy CI environment stub
        run: cp .env.ci .env

      - name: Lint
        run: pnpm lint

      - name: Build
        run: pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/
git commit -m "chore: replace base.yml with PR checks workflow (lint + build)"
```

---

## Task 7: Migrate TASKS.md to GitHub Issues

**Files:** None (GitHub API only — creates issues)

This task creates GitHub Issues for every non-completed item in TASKS.md. Issues are created in dependency order. **Capture the issue number** from each `gh issue create` output (printed as a URL like `https://github.com/.../issues/N`) and substitute into dependent issue bodies.

- [ ] **Step 1: Create Issue — Notion CRM Migration**

Status: Ready to Execute → Column: Ready, Label: `claude:ready`

```bash
NOTION_ISSUE_URL=$(gh issue create \
  --title "Notion CRM Migration" \
  --body "$(cat <<'EOF'
Remove Notion as the customer source; customers become first-class DB citizens with their own entry flow.

**Context:** [docs/tasks/notion-crm-migration.md](docs/tasks/notion-crm-migration.md)
**Spec:** [docs/superpowers/specs/2026-03-19-notion-crm-migration-design.md](docs/superpowers/specs/2026-03-19-notion-crm-migration-design.md)
**Plan:** [docs/superpowers/plans/2026-03-19-notion-crm-migration.md](docs/superpowers/plans/2026-03-19-notion-crm-migration.md)
**Branch:** `migrating-notion` (in progress)
EOF
)" \
  --label "area:backend,area:sales-flow,P1,type:feature,claude:ready" \
  --repo OlisDevSpot/tri-pros-website)
NOTION_ISSUE_NUM=$(echo "$NOTION_ISSUE_URL" | grep -oP '\d+$')
echo "Notion CRM Migration: #$NOTION_ISSUE_NUM"
```

- [ ] **Step 2: Create Issue — Pipeline Native Customers**

Status: Blocked → Column: Backlog, Label: `claude:blocked`

```bash
gh issue create \
  --title "Pipeline Native Customers" \
  --body "$(cat <<EOF
Add \`needs_confirmation\` stage, \`CreateMeetingModal\`, \`meetingScopesJSON\`, remove dashboard shortcuts.

Depends on #${NOTION_ISSUE_NUM} (Notion CRM Migration must complete first)

**Context:** [docs/tasks/pipeline-native-customers.md](docs/tasks/pipeline-native-customers.md)
**Spec:** [docs/superpowers/specs/2026-03-19-pipeline-native-customers-design.md](docs/superpowers/specs/2026-03-19-pipeline-native-customers-design.md)
EOF
)" \
  --label "area:sales-flow,P1,type:feature,claude:blocked" \
  --repo OlisDevSpot/tri-pros-website
```

- [ ] **Step 3: Create Issue — Services Pages Redesign**

Status: Partially Done → Column: Backlog

```bash
gh issue create \
  --title "Services Pages Redesign" \
  --body "$(cat <<'EOF'
Pillar pages (energy / luxury) from Notion with ISR — trade-specific service landing pages.

**Status:** Routes + components built; needs redesign — not satisfied with current results.

**Context:** [docs/tasks/services-pages-redesign.md](docs/tasks/services-pages-redesign.md)
**Spec:** [docs/superpowers/specs/2026-03-18-services-pages-redesign.md](docs/superpowers/specs/2026-03-18-services-pages-redesign.md)
EOF
)" \
  --label "area:frontend,P2,type:feature" \
  --repo OlisDevSpot/tri-pros-website
```

- [ ] **Step 4: Create Issue — Google Drive Upload Integration**

```bash
gh issue create \
  --title "Google Drive Upload Integration" \
  --body "$(cat <<'EOF'
Agents upload project photos to Google Drive from the showroom editor.

**Context:** [docs/tasks/google-drive-upload.md](docs/tasks/google-drive-upload.md)
**Spec:** [docs/superpowers/specs/2026-03-18-google-drive-upload-design.md](docs/superpowers/specs/2026-03-18-google-drive-upload-design.md)
EOF
)" \
  --label "area:integrations,P2,type:feature" \
  --repo OlisDevSpot/tri-pros-website
```

- [ ] **Step 5: Create Issue — Meta Ads Integration**

Status: Blocked → Column: Backlog, Label: `claude:blocked`

```bash
gh issue create \
  --title "Meta Ads Integration" \
  --body "$(cat <<'EOF'
All scripts built, Pixel created, ad account ready — blocked on switching Meta app to Published mode, then run `pnpm meta init-account`.

**Blocked by:** Meta app must be Published at developers.facebook.com

**Context:** [docs/tasks/meta-ads-integration.md](docs/tasks/meta-ads-integration.md) · [docs/meta-ads-session-handoff.md](docs/meta-ads-session-handoff.md)
EOF
)" \
  --label "area:integrations,P1,type:feature,claude:blocked" \
  --repo OlisDevSpot/tri-pros-website
```

- [ ] **Step 6: Create Issue — Progressive Agent Permissions**

```bash
PERMS_ISSUE_URL=$(gh issue create \
  --title "Progressive Agent Permissions" \
  --body "$(cat <<'EOF'
CASL `CustomerFile` subject, `customer_file_grants` table, presigned URL procedure with grant check, super-admin grant UI. Agents have zero default access — super-admin must explicitly reveal files.

**Context:** [docs/tasks/customer-file-permissions.md](docs/tasks/customer-file-permissions.md)
EOF
)" \
  --label "area:backend,P3,type:feature" \
  --repo OlisDevSpot/tri-pros-website)
PERMS_ISSUE_NUM=$(echo "$PERMS_ISSUE_URL" | grep -oP '\d+$')
echo "Progressive Agent Permissions: #$PERMS_ISSUE_NUM"
```

- [ ] **Step 7: Create Issue — Customer File Management System**

```bash
gh issue create \
  --title "Customer File Management System" \
  --body "$(cat <<EOF
Per-customer file browser — MP3 player, document viewer, organized by \`tpr-homeowner-files/{customerId}/\` R2 structure.

Depends on #${PERMS_ISSUE_NUM} (Progressive Agent Permissions for access control)

**Context:** [docs/tasks/customer-file-permissions.md](docs/tasks/customer-file-permissions.md)
EOF
)" \
  --label "area:frontend,area:backend,P3,type:feature" \
  --repo OlisDevSpot/tri-pros-website
```

- [ ] **Step 8: Create Issue — Portfolio Image Optimization**

```bash
gh issue create \
  --title "Portfolio Image Optimization" \
  --body "$(cat <<'EOF'
Optimize showroom/portfolio photo loading — Next.js `<Image>`, blurDataURL placeholders, responsive sizing, lazy loading. Critical for performance with many project photos.
EOF
)" \
  --label "area:showroom,P2,type:refactor" \
  --repo OlisDevSpot/tri-pros-website
```

- [ ] **Step 9: Create Issue — Agent Profile & Settings**

```bash
gh issue create \
  --title "Agent Profile & Settings" \
  --body "$(cat <<'EOF'
Profile page — update personal settings, view company metadata, useful links, external resources.
EOF
)" \
  --label "area:frontend,P3,type:feature" \
  --repo OlisDevSpot/tri-pros-website
```

- [ ] **Step 10: Create Issue — Super-Admin User Assignment**

```bash
gh issue create \
  --title "Super-Admin User Assignment" \
  --body "$(cat <<'EOF'
Reusable `InternalUserSelect` component with profile cards (avatar + email muted/small under name). Data source: `intakeRouter.getInternalUsers` (extend to return `email`, `image`). Enables super-admins to reassign meeting/proposal ownership.

Currently the intake form's `MeetingSchedulerField` has this dropdown — extract + enhance into shared component.
EOF
)" \
  --label "area:sales-flow,P3,type:feature" \
  --repo OlisDevSpot/tri-pros-website
```

- [ ] **Step 11: Create Issue — Intake Form UX Overhaul**

```bash
gh issue create \
  --title "Intake Form UX Overhaul" \
  --body "$(cat <<'EOF'
Three fixes:

1. Wrap intake page in `ViewportHero` + `TopSpacer` (hero too close to navbar — match landing page structure from `pillar-view.tsx`)
2. Add trade selection (≥1 required) + optional scope picker — reuse existing `TradeScopeRow` pattern but decouple from `react-hook-form`/`ProjectFormData` since intake uses `useState`
3. Remove internal-user dropdown from external-facing intake forms — that dropdown belongs only in the `MeetingSchedulerField` (conditional on `formConfig.showMeetingScheduler`)

**Key files:**
- `src/app/(frontend)/(site)/intake/[token]/page.tsx`
- `src/features/intake/ui/views/intake-form-view.tsx`
- `src/features/intake/ui/components/meeting-scheduler-field.tsx`
- `src/features/showroom/ui/components/form/trade-scope-row.tsx`
EOF
)" \
  --label "area:sales-flow,area:frontend,P2,type:feature" \
  --repo OlisDevSpot/tri-pros-website
```

- [ ] **Step 12: Verify all issues were created**

Run: `gh issue list --repo OlisDevSpot/tri-pros-website --limit 20`
Expected: 11 issues matching the tasks above.

---

## Task 8: Add Issues to Project Board

**Files:** None (GitHub API only)

- [ ] **Step 1: Get the project number**

```bash
PROJECT_NUM=$(gh project list --owner OlisDevSpot --format json --jq '.[] | select(.title=="Tri Pros Development") | .number')
echo "Project number: $PROJECT_NUM"
```

- [ ] **Step 2: Add all issues to the project**

```bash
for i in $(gh issue list --repo OlisDevSpot/tri-pros-website --limit 20 --json number --jq '.[].number'); do
  gh project item-add $PROJECT_NUM --owner OlisDevSpot --url "https://github.com/OlisDevSpot/tri-pros-website/issues/$i"
done
```

- [ ] **Step 3: Move issues to correct columns**

Issue #1 (Notion CRM Migration) should be in "Ready" column. All others start in "Backlog" (the default via automation).

This step requires using the GitHub web UI or the GraphQL API. The simplest approach is to do it in the browser:

1. Open the project board URL
2. Drag issue #1 to the "Ready" column
3. Verify blocked issues (#2 Pipeline Native Customers, #5 Meta Ads Integration) are in Backlog with `claude:blocked` label
4. Verify all other issues are in Backlog

- [ ] **Step 4: Verify board state**

Open the project board and confirm:
- "Ready" column: 1 card (Notion CRM Migration)
- "Backlog" column: 10 cards
- "In Progress", "In Review", "Done": empty

---

## Task 9: Update TASKS.md as Redirect

**Files:**
- Modify: `docs/tasks/TASKS.md`

- [ ] **Step 1: Replace TASKS.md content**

Replace the entire file with a redirect to the GitHub Project board:

```markdown
# Task Tracker — Moved to GitHub

This task tracker has been migrated to the GitHub Project board.

**Board:** https://github.com/orgs/OlisDevSpot/projects/<NUMBER>
(or https://github.com/users/OlisDevSpot/projects/<NUMBER> if user project)

**Issues:** https://github.com/OlisDevSpot/tri-pros-website/issues

All task context files in this directory (`docs/tasks/*.md`) are still valid references — they are linked from the GitHub Issues.

---

*Migrated on 2026-03-22. See [github-workflow-pipeline-design.md](../superpowers/specs/2026-03-22-github-workflow-pipeline-design.md) for the full design.*
```

- [ ] **Step 2: Commit**

```bash
git add docs/tasks/TASKS.md
git commit -m "chore: migrate TASKS.md to GitHub Issues — add redirect"
```

---

## Task 10: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add GitHub Workflow section to CLAUDE.md**

Add this section before the `## WHO WE ARE` section at the end of CLAUDE.md:

```markdown
## GitHub Workflow

All work is tracked via GitHub Issues and a Project kanban board.

**Board:** https://github.com/orgs/OlisDevSpot/projects/<NUMBER>

### Branch Convention
`{type}/{issue-number}-{short-description}`
Types: `feat`, `fix`, `refactor`, `chore`

### PR Process
1. Create branch from `main` following naming convention
2. Work + commit (conventional commits: `feat(scope):`, `fix(scope):`, etc.)
3. Self-review: run `pnpm lint` + `pnpm build`, review diff for quality/conventions
4. Open PR using the template (Summary, Changes, Self-Review, Test Plan)
5. Link issue with `Closes #N` in PR body
6. Wait for CI checks + human review before merge

### Labels
- **Area:** `area:frontend`, `area:backend`, `area:infrastructure`, `area:sales-flow`, `area:integrations`, `area:showroom`
- **Priority:** `P0` (urgent), `P1` (important), `P2` (nice-to-have), `P3` (backlog)
- **Type:** `type:feature`, `type:bug`, `type:refactor`, `type:chore`
- **Workflow:** `claude:ready` (pick up), `claude:blocked` (needs human input), `claude:in-progress` (actively working)

### Agent Workflow
1. Find issue labeled `claude:ready` → change to `claude:in-progress`
2. Create branch → work → commit
3. Self-review (lint, build, diff review)
4. Open PR with `Closes #N` → remove `claude:in-progress` label
5. Wait for CI + human review → human merges → issue auto-closes
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add GitHub workflow conventions to CLAUDE.md"
```

---

## Task 11: Update Claude Memory

**Files:**
- Create: `/home/olis-solutions/.claude/projects/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/memory/project-github-workflow.md`
- Modify: `/home/olis-solutions/.claude/projects/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/memory/MEMORY.md`

- [ ] **Step 1: Create memory file**

Create `project-github-workflow.md`:

```markdown
---
name: GitHub Workflow Pipeline
description: GitHub Issues + Projects kanban + PRs as the development pipeline — labels, conventions, agent workflow, CI checks
type: project
---

## What This Is

A GitHub-native workflow pipeline replacing TASKS.md. Issues are task tickets, a kanban board provides visibility, PRs with CI checks are the review gate.

**Why:** Enable Claude agents to autonomously pick up, execute, and deliver work through a structured, traceable pipeline. The user stays informed via the board and GitHub notifications without babysitting.

**How to apply:** All new work should follow this pipeline. Check the board for `claude:ready` issues. Create branches with the naming convention. Open PRs with the template. Link issues with `Closes #N`.

## Key References

| Resource | Location |
|---|---|
| Project Board | https://github.com/orgs/OlisDevSpot/projects/<NUMBER> |
| Design Spec | `docs/superpowers/specs/2026-03-22-github-workflow-pipeline-design.md` |
| PR Template | `.github/pull_request_template.md` |
| CI Workflow | `.github/workflows/pr-checks.yml` |
| CI Env Stub | `.env.ci` |

## Label Quick Reference

- **Area:** `area:frontend`, `area:backend`, `area:infrastructure`, `area:sales-flow`, `area:integrations`, `area:showroom`
- **Priority:** `P0`, `P1`, `P2`, `P3`
- **Type:** `type:feature`, `type:bug`, `type:refactor`, `type:chore`
- **Workflow:** `claude:ready`, `claude:blocked`, `claude:in-progress`

## Agent Pickup Flow

1. Find `claude:ready` issue → swap label to `claude:in-progress`
2. Create branch: `{type}/{issue-number}-{short-description}`
3. Work + conventional commits
4. Self-review (lint, build, diff)
5. Open PR with `Closes #N` → remove `claude:in-progress`
6. Wait for CI + human merge
```

- [ ] **Step 2: Update MEMORY.md index**

Add a line under the "## In-Progress Work" section (or create a "## Workflow" section):

```markdown
## Workflow
- [GitHub Workflow Pipeline](project-github-workflow.md) — Issues + Projects kanban + PRs as dev pipeline. Labels, conventions, agent workflow, CI checks. **READ THIS at session start for how to pick up and deliver work.**
```

- [ ] **Step 3: Verify memory file is readable**

Run: `cat /home/olis-solutions/.claude/projects/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/memory/project-github-workflow.md | head -5`
Expected: The frontmatter header of the memory file.

---

## Task 12: Final Verification

**Files:** None

- [ ] **Step 1: Verify labels**

Run: `gh label list --repo OlisDevSpot/tri-pros-website`
Expected: 17 labels (6 area + 4 priority + 4 type + 3 workflow)

- [ ] **Step 2: Verify issues**

Run: `gh issue list --repo OlisDevSpot/tri-pros-website --limit 20`
Expected: 11 open issues

- [ ] **Step 3: Verify project board**

Run: `gh project list --owner OlisDevSpot`
Expected: "Tri Pros Development" project listed

- [ ] **Step 4: Verify PR template exists**

Run: `cat .github/pull_request_template.md | head -3`
Expected: `## Summary`

- [ ] **Step 5: Verify CI workflow exists**

Run: `cat .github/workflows/pr-checks.yml | head -3`
Expected: `name: PR Checks`

- [ ] **Step 6: Verify .env.ci exists and is tracked**

Run: `git ls-files .env.ci`
Expected: `.env.ci` (file is tracked by git)

- [ ] **Step 7: Verify old workflow is deleted**

Run: `ls .github/workflows/base.yml 2>/dev/null && echo "STILL EXISTS" || echo "DELETED"`
Expected: `DELETED`

- [ ] **Step 8: Push all commits**

```bash
git push origin main
```

Verify: All files are on GitHub.
