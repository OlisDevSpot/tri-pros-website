# GitHub Issue Management — Design Spec

> **Status:** approved, awaiting implementation plan
> **Date:** 2026-05-21
> **Owner:** @OlisDevSpot
> **Decision model:** Option A — GitHub is the source of truth, `.md` is reference only

---

## 0. Starting point

**Today (the problem):**

- 5 things acting as "epics" with 4 different shapes:
  - SEO #222 — inline decision log + links to `docs/seo/`, bullet checklist sub-issues (not native)
  - Construction Data #195 — inline architecture decisions, phased migration linked by title prefix
  - Ably Realtime Kernel #178 — links to `docs/superpowers/specs/` + handoff, task-list checkbox phases (not native)
  - tRPC Entity Server System — **no parent epic**, scattered across #194, #209, #213, #214
  - Entity Action System — **no parent epic**, scattered across #171-#175
- Two competing "source of truth" surfaces for project state:
  - **GitHub**: 60+ issues, board at https://github.com/users/OlisDevSpot/projects/3
  - **`.md` files**: `docs/plans/*.md`, `memory/project-*.md` (15+ trackers), `docs/superpowers/specs/*.md`, `docs/superpowers/handoff/*.md`
- Issue creation entry points are inconsistent:
  - Most issues created via natural-language conversation with a Claude session that doesn't know the templates
  - Some via `pnpm dispatch cmd_feedback` (line 1715, embeds body string)
  - Occasionally direct via GH UI

**Constraint:** `OlisDevSpot` is a personal account. **Issue Types are org-only** — we use `type:*` labels (already in place) as the substitute.

**Goal (Option A, locked):**

- Epic body holds the full feature + decision context.
- `docs/plans/*.md`, `docs/superpowers/specs/*.md`, `docs/superpowers/handoff/*.md`, `memory/project-*.md` get migrated into epic bodies and deleted.
- ADRs, `docs/codebase-conventions/`, `src/<dir>/DOCS.md`, `docs/how-to/`, `docs/seo/`, `docs/domain/` stay as durable refs that epics link to.
- Closed epics are the historical record — searched via GitHub, not memory files.

---

## 1. The five enforcement layers

A single rulebook enforced at every entry point. No path to a malformed issue.

| Layer | Artifact | Enforces | Audience |
|---|---|---|---|
| 1 | `docs/codebase-conventions/github-workflow.md` | Canonical, slug-anchored spec | Humans + Claude (referenced) |
| 2 | `CLAUDE.md` § GitHub workflow (load-bearing rules inline + pointer to Layer 1) | Auto-loaded every session | Every Claude session in the repo |
| 3 | `pnpm dispatch` regenerated `CLAUDE.local.md` (rules embedded, parent epic body included) | Dispatched session has rules + epic context locally | Dispatched Claude sessions |
| 4 | `.github/ISSUE_TEMPLATE/*.md` (epic-shippable, epic-program, sub-issue, standalone) | GH UI shows correct skeleton; programmatic templating substrate for both bash and Claude paths | GH UI users + `dispatch.sh` + skill |
| 5 | `.claude/skills/gh-issue-management/SKILL.md` (project-local, committed) | Natural-language creation routed through canonical rules | Claude sessions creating issues conversationally |

Layers 1–3 communicate the rules. Layer 4 is the templating substrate. Layer 5 is the natural-language entry point.

---

## 2. Issue taxonomy

### 2.1 Three issue shapes

| Shape | Labels | Purpose | Lifecycle |
|---|---|---|---|
| **Shippable epic** | `type:epic` + `area:*` + `P*` | Feature, refactor, or migration with a definite finish line | Closes when last sub-issue closes (or manually with explicit decision-log entry) |
| **Program epic** | `type:epic` + `lifecycle:program` + `area:*` + `P*` | Long-running program tracker with KPIs, kill criteria, periodic status updates | Stays open indefinitely; closes only on pivot/kill |
| **Sub-issue / standalone** | `type:feature` \| `type:refactor` \| `type:bug` \| `type:chore` + `area:*` + `P*` + optionally `claude` | Scoped, PR-sized unit of work | Closes when PR merges |

**New label to add:** `lifecycle:program` (color: `006B75` dark teal — distinct from the existing dark-blue `type:epic` and purple `area:seo`. Description: "Program tracker — long-running, stays open indefinitely")

**`claude` label semantics** (unchanged): agent-eligible — `pnpm dispatch` may pick this up automatically.

### 2.2 Nesting

- **GitHub native sub-issues** for parent/child relationships at every level.
- **No depth limit by policy**, but lean toward two levels (epic → sub-issue) for most work. Three levels (epic → feature → task) only when a sub-issue genuinely warrants its own scoped child issues (e.g., a phase that splits into 5+ PRs).
- **Decisions live only at the epic level.** Sub-issues that surface a new decision append it to the parent epic's body and link to it.

### 2.3 Dependencies

- **GitHub native `blocks` / `blocked-by`** (currently in public preview on personal repos — accessible via REST API: `POST /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by`).
- Surfaces in Projects v2 roadmap view and on the issue page.
- **Fallback:** if the preview feature is unavailable or unreliable, the skill writes `**Blocked by:** #N` lines into the issue body, and `find_next_ready_issue` in dispatch parses these. The skill abstracts over both representations.

---

## 3. Canonical templates

### 3.1 Shippable epic template

```markdown
# [Area] Epic Title

> **Status:** active | deferred | shipped | killed
> **Started:** YYYY-MM-DD
> **Owner:** @user
> **Target:** measurable outcome / acceptance condition

## Why
1 paragraph: the problem this solves, why now.

## Scope
**In scope:**
- bullets

**Out of scope / deferred to follow-ups:**
- bullets (link follow-up issues if known)

## Decisions
Append-only log. Each entry dated. Locked unless explicitly amended.

### YYYY-MM-DD — Short decision title
- **Question:** ...
- **Chosen:** ...
- **Why:** ...
- **Trade-offs / what we gave up:** ...
- **Discussion:** link to comment thread or #N if applicable

## Architecture
Inline notes IF small. If this section grows past ~300 lines or is referenced by code,
promote to `docs/adr/NNNN-*.md` and replace with a link.

## References
- ADR-XXXX
- `src/foo/DOCS.md#bar`
- `docs/codebase-conventions/baz.md`
- Related issues: #N, #M

## Sub-issues
GitHub auto-renders the native sub-issue panel. For epics with >10 children,
include a categorized list here grouped by phase / theme.

## Acceptance criteria
- [ ] All sub-issues closed
- [ ] Concrete behavioral outcomes verified
- [ ] DOCS.md / ADR updated as needed
- [ ] (other invariants specific to this epic)
```

### 3.2 Program epic template

Same as shippable, with these diffs:

- Header includes `> **Lifecycle:** program`
- `## Acceptance criteria` → replaced by `## KPI table` (target metrics by time horizon)
- Add `## Kill criteria` (conditions for pivot/kill — SEO #222 has the canonical example)
- Add `## Status updates` (append-only dated snapshots — monthly/quarterly standup notes)
- Add `## Amendment policy` (how locked decisions get changed — SEO #222 has the canonical example)
- `## Decisions` section often titled `## Locked decisions` to emphasize stability

### 3.3 Sub-issue template

```markdown
# Sub-issue title

> **Parent:** #N (auto-linked by GH native sub-issue relationship)
> **Blocks:** #M, #O (if applicable)
> **Blocked by:** #P (if applicable)

## Goal
1-3 sentences. What does this sub-issue accomplish in service of the parent epic?

## Scope
**In:** bullets
**Out:** bullets (with link to follow-up issue if known)

## Acceptance criteria
- [ ] Concrete, verifiable bullets
- [ ] Tests pass / lint clean / docs updated where applicable

## References
- Parent decisions: #N (link to specific decision if applicable)
- ADR / DOCS.md / code paths as needed
- Related sub-issues
```

Sub-issues do **not** have their own decision log. If a sub-issue surfaces a new decision, append it to the parent epic's body and link to it from the sub-issue.

### 3.4 Standalone template

For tactical work that genuinely doesn't belong to an epic (e.g., one-off bug fixes, dependency bumps, small chores). Lightest skeleton:

```markdown
# Standalone issue title

> **Blocks:** #M (if applicable)
> **Blocked by:** #P (if applicable)

## Goal
Sentences describing what this fixes/changes and why.

## Acceptance criteria
- [ ] Concrete, verifiable bullets

## References
- ADR / DOCS.md / code paths as needed
```

The skill warns when creating a standalone issue whose description overlaps with an open epic's scope, suggesting "should this be a sub-issue of #N instead?" The human can decline.

---

## 4. The skill — `gh-issue-management`

### 4.1 Identity

- **Name:** `gh-issue-management`
- **Location:** `.claude/skills/gh-issue-management/SKILL.md` (project-local, committed to the repo)
- **Discoverability:** Auto-loaded by Claude Code in every session within this repo. Description is aggressive enough that any natural-language issue request matches it.

### 4.2 Description (used for matcher activation)

```
Use this skill whenever creating, modifying, or closing GitHub issues in this repo —
epics, sub-issues, standalone issues, decisions, dependencies, status updates, or
migrating stale .md plans into epics. Triggers on natural language like "create an
issue", "add a sub-issue", "open an epic", "log a decision", "this is blocked by",
"promote this plan to an epic", or any request that touches GH issues/projects/board
for this codebase. MANDATORY — do not create issues with gh CLI directly; route
through this skill so templates, labels, and relationships stay consistent.
```

### 4.3 Operations

| Operation | Trigger phrases | Behavior |
|---|---|---|
| `create-shippable-epic` | "create an epic for X", "track X as a feature" | Pulls `.github/ISSUE_TEMPLATE/epic-shippable.md`, fills via Q&A if input is thin, applies `type:epic` + inferred `area:*` + confirmed `P*` labels, creates via `gh issue create`, adds to Projects v2 board |
| `create-program-epic` | "create a program tracker for X", "this is a long-running program" | Same but program template, adds `lifecycle:program`, requires KPI table + kill criteria up front |
| `create-sub-issue` | "create a sub-issue under #N for X", "add X as a child of #N" | Pulls sub-issue template, requires parent ref, auto-links via `gh api POST /repos/.../issues/{N}/sub_issues` |
| `create-standalone` | "create an issue for X" (when no epic context detected) | Standalone template. Skill scans open epics; if scope overlap detected, asks "should this be a sub-issue of #N instead?" |
| `add-decision` | "log a decision on #N: we chose X because Y" | Reads issue body, finds `## Decisions` (or `## Locked decisions` for program), appends new dated entry between that heading and the next `##`. Append-only — never edits existing decisions. Validates: Question / Chosen / Why / Trade-offs all present. |
| `link-dependency` | "this is blocked by #M", "add #M as a blocker for #N" | Uses native `blocks`/`blocked-by` REST API. Falls back to body-text convention if preview unavailable. |
| `migrate-plan` | "promote `docs/plans/foo.md` to an epic", "turn this memory file into an epic" | Reads source file, drafts epic body, opens epic, scans `CLAUDE.md` and other docs for references to the source file, proposes ref updates, deletes source file (after user confirmation) |
| `add-status-update` | "log a status update on the SEO epic", "monthly check-in on #222" | For program epics — appends dated snapshot to `## Status updates` |
| `close-epic` | "close epic #N" | Verifies all sub-issues closed, prompts for retrospective decision-log entries, optionally drafts a closing comment, closes |

### 4.4 Intelligence behaviors (the "smart" part)

All of these MUST be active — friction at creation prevents drift later.

- **Area-label inference** from description keywords against the existing `area:*` taxonomy (`frontend`, `backend`, `infrastructure`, `sales-flow`, `integrations`, `showroom`, `seo`). Confirmed by user before commit.
- **Priority suggestion** based on urgency language (e.g., "blocking revenue" → suggest P0), always confirmed.
- **Parent-epic detection** — when creating an issue, the skill scans titles + bodies of open epics for scope overlap and suggests "this might belong under #195 Construction Data — should I make it a sub-issue?"
- **Acceptance-criteria validation** — refuses to create an issue whose criteria contain vague language ("works correctly", "looks good", "is fixed"). Pushes back with concrete suggestions.
- **Decision-log completeness** — when appending a decision, requires all four fields (Question / Chosen / Why / Trade-offs). Won't accept "we decided X" without the surrounding context.
- **Stale-doc detection** — when migrating a plan file, greps `CLAUDE.md`, `MEMORY.md`, and other tracked docs for references to the source file. Proposes ref updates as part of the migration.
- **Sub-issue auto-promotion** — if a new sub-issue is being created and its scope is large enough that it itself warrants children, skill suggests promoting to a sub-epic.

### 4.5 Skill structure (progressive disclosure)

```
.claude/skills/gh-issue-management/
├── SKILL.md                          # description + operation index + load-bearing rules
├── operations/
│   ├── create-shippable-epic.md
│   ├── create-program-epic.md
│   ├── create-sub-issue.md
│   ├── create-standalone.md
│   ├── add-decision.md
│   ├── link-dependency.md
│   ├── migrate-plan.md
│   ├── add-status-update.md
│   └── close-epic.md
├── reference/
│   ├── label-taxonomy.md             # current label vocabulary + inference rules
│   ├── area-keywords.md              # keyword → area mapping
│   └── api-cheatsheet.md             # gh CLI + gh api endpoints for sub-issues & dependencies
```

`SKILL.md` is the load-bearing entry; operation files are loaded on demand based on which operation matches the request.

---

## 5. Dispatch script changes

`scripts/dispatch.sh` (1,954 lines) stays focused on its core job: spawning, working on, reviewing, and closing existing issues. **Dispatch does not create new epics.** Surgical changes only:

| # | Change | Where | Reason |
|---|---|---|---|
| D1 | Read templates from `.github/ISSUE_TEMPLATE/sub-issue.md` instead of inlining body string | `cmd_feedback` at line 1715 | Single source of truth — bash and Claude paths use the same template |
| D2 | Filter out blocked issues | `find_next_ready_issue` at line 589 | Don't pick up work that has open `blocked-by` dependencies. Use `gh api` to query dependencies; fall back to body-text parsing. |
| D3 | Prefer sub-issues whose parent epic is open | `find_next_ready_issue` at line 589 | Deprioritize orphaned work; respect epic lifecycle |
| D4 | Include parent epic body in dispatched-session `CLAUDE.local.md` | CLAUDE.local.md generation block (location TBD during implementation) | Layer 3 enforcement: dispatched Claude has full context — parent decisions, scope, references |
| D5 | Include GitHub workflow rules in dispatched-session `CLAUDE.local.md` | Same | Layer 3 enforcement: dispatched Claude knows not to create issues with bare `gh` |
| D6 | PR body references both sub-issue (`Closes #N`) and parent epic (`Part of #M`) | `cmd_pr` at line 1057 | GH auto-closes the sub-issue on merge; epic stays open until all children done; humans see the relationship in the PR |
| D7 | `cmd_help` mentions `gh-issue-management` skill for creation | `cmd_help` at line 1860 | Discoverability — `pnpm dispatch help` tells future-you "ask Claude to create issues" |

**No new `cmd_*` functions.** No issue-creation command in dispatch. The skill is the creation surface; dispatch is the execution surface.

---

## 6. Projects v2 board changes

Board: https://github.com/users/OlisDevSpot/projects/3

| # | Change | Reason |
|---|---|---|
| B1 | Add custom field `Lifecycle` with values `shippable` / `program` | Filter program epics separately from shippable work in board views |
| B2 | Add custom field `Parent Epic` (issue reference) | Surfaces parent-child relationships in board views even when not using GH's hierarchy view |
| B3 | Add "Epics" view filtered to `type:epic` label, grouped by `Lifecycle`, sorted by priority | Quick overview of all in-flight epics |
| B4 | Add "Roadmap" view visualizing dependencies between epics + their sub-issues | Visual dependency graph for planning |
| B5 | Configure auto-add: any new issue with `type:epic` or `claude` label auto-added to the board | Reduce manual board management |

**Board membership rule:** all issues created through the skill (epics, sub-issues, standalone) are added to the board at creation time — regardless of label. Auto-add rules in B5 are belt-and-suspenders for issues created outside the skill (GH UI, dispatch follow-ups). Existing `gh project item-add` calls in dispatch handle the `claude`-labeled path today; the skill extends this to every path it creates.

---

## 7. Migration plan — strangler fig

Build the infrastructure first. Existing epics get normalized as they're touched in real work. No big-bang weekend.

### Phase 1 — Infrastructure (~3-4 hour focused session)

Done in one PR. All five layers ship together.

1. Write `docs/codebase-conventions/github-workflow.md` (Layer 1) — full canonical spec
2. Update `CLAUDE.md` § GitHub workflow with load-bearing rules + pointer to Layer 1 (Layer 2)
3. Add `.github/ISSUE_TEMPLATE/`:
   - `epic-shippable.md` (YAML frontmatter: `labels: [type:epic]`, `name: "Shippable Epic"`, `about: "..."`)
   - `epic-program.md` (YAML frontmatter: `labels: [type:epic, lifecycle:program]`)
   - `sub-issue.md`
   - `standalone.md`
   - `config.yml` (blank_issues_enabled: false — force template selection)
4. Add `lifecycle:program` label via `gh label create`
5. Build `.claude/skills/gh-issue-management/` (Layer 5):
   - `SKILL.md`
   - `operations/*.md` (9 files)
   - `reference/*.md` (3 files)
6. Update `scripts/dispatch.sh` per Section 5 (Layer 3 + templating)
7. Configure Projects v2 board per Section 6
8. Smoke-test acceptance gate:
   - Create one new shippable epic end-to-end through the skill
   - Create one sub-issue under it
   - One dispatched session reads parent epic body in its `CLAUDE.local.md`
   - Confirm `find_next_ready_issue` skips a manually-blocked issue

### Phase 2 — Existing epic normalization (incremental, as touched)

No dedicated migration session — happens naturally when each epic is next picked up in real work.

| Epic | Migration touch |
|---|---|
| **SEO #222** | Already 90% program-template. Add native sub-issue links from the bullet checklist (currently text-only). Verify KPI + kill criteria sections present. |
| **Construction Data #195** | Already close to shippable template. Reformat Decisions to dated entries. Link existing #196-#206 as native sub-issues. |
| **Ably Kernel #178** | Inline spec from `docs/superpowers/specs/2026-04-19-ably-realtime-kernel-design.md` into epic body. Delete the spec file + handoff file. Link #179-#184 as native sub-issues. |
| **tRPC Entity Server System** (NEW) | Create new shippable epic. Cover #194, #209, #213, #214 + future entity migrations. Pull decisions from `docs/adr/0002` (which stays — ADRs survive Option A) + `docs/plans/entity-server-migration-punch-list.md` (which gets deleted after content moves). |
| **Entity Action System** (NEW) | Create new shippable epic. Cover #171-#175. Pull from ADR-0001. |

### Phase 3 — `.md` cleanup (parallel, manual confirmation each time)

Performed alongside Phase 2 work using `skill: migrate-plan`.

- **`docs/plans/*.md`** — Each file: promote to epic OR fold into existing epic body OR delete if obsolete. File deleted in same commit as the content move.
- **`docs/superpowers/specs/*.md`** — Specs older than current work or already shipped: delete. Active specs: inline into their epic body, then delete.
- **`docs/superpowers/handoff/*.md`** — Same as specs.
- **`memory/project-*.md`** — 15 entries. Delete each as its corresponding epic gets normalized in Phase 2. Manual confirmation per delete via the skill's `migrate-plan` operation.

### Phase 4 — Memory promotions (separate effort, not blocking)

Not part of this design. Tracked separately. `memory/feedback-*.md`, `pattern-*.md`, `reference-*.md` that describe durable engineering knowledge → promote to `docs/codebase-conventions/` over time. The existing self-healing ritual in `docs/codebase-conventions/README.md` already covers this workflow.

---

## 8. Acceptance criteria

Phase 1 is complete when all of the following are true:

- [ ] `docs/codebase-conventions/github-workflow.md` exists and is the canonical spec
- [ ] `CLAUDE.md` § GitHub workflow has load-bearing rules + pointer to Layer 1
- [ ] `.github/ISSUE_TEMPLATE/{epic-shippable,epic-program,sub-issue,standalone}.md` all exist with correct YAML frontmatter
- [ ] `.github/ISSUE_TEMPLATE/config.yml` disables blank issues
- [ ] `lifecycle:program` label exists in the repo
- [ ] `.claude/skills/gh-issue-management/SKILL.md` + operation files + reference files all exist
- [ ] `scripts/dispatch.sh` D1–D7 implemented and tested
- [ ] Projects v2 board has `Lifecycle` and `Parent Epic` custom fields + Epics view + Roadmap view + auto-add rules
- [ ] Smoke test: one shippable epic created end-to-end through skill
- [ ] Smoke test: one sub-issue created and parent-linked via native API
- [ ] Smoke test: dispatched session's `CLAUDE.local.md` contains parent epic body + workflow rules
- [ ] Smoke test: `find_next_ready_issue` skips a blocked issue

---

## 9. Open decisions (intentionally deferred)

These are explicitly NOT decided in this spec — to be resolved during implementation planning or post-Phase-1:

- **Skill prompt-engineering specifics** — exact phrasing of clarifying-question flows, how aggressive scope-overlap warnings should be, how the skill handles ambiguous parent-epic suggestions. Resolved during skill implementation by iterating against real use.
- **Exact Projects v2 view configurations** — column layouts, group-by fields, sort orders. Resolved by configuring once and iterating.
- **Phase 2 ordering** — which existing epic gets normalized first. Decided as real work pulls each into focus.
- **`memory/` long-term fate** — Phase 4 is out of scope here. Tracked separately.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| GH `blocks`/`blocked-by` preview API changes or is deprecated | Skill abstracts over native API and body-text fallback. Switch is one code change. |
| Sub-issue REST API rate limits or quirks | Discovered during smoke testing. Skill includes retry logic. |
| Skill description doesn't match aggressively enough → Claude creates issues with bare `gh` anyway | Layer 2 (CLAUDE.md) + Layer 3 (dispatched CLAUDE.local.md) reinforce the rule with explicit prose. Iterate skill description if drift observed. |
| Phase 2 stalls because epics aren't touched → existing inconsistent formats persist | Acceptable — by definition, an untouched epic isn't actively causing pain. The strangler fig finishes when all in-flight work has been touched. |
| Projects v2 custom fields don't survive a board template change | One-time setup, well-documented. Re-apply if the board is ever rebuilt. |

---

## 11. What dies, what lives — explicit reference

**Dies in Option A:**
- `docs/plans/*.md` (content migrates into epic bodies, files deleted)
- `docs/superpowers/specs/*.md` (this spec lives here briefly, then dies after implementation epic closes)
- `docs/superpowers/handoff/*.md`
- `memory/project-*.md` (15+ entries)

**Lives:**
- `docs/adr/*.md` — architectural decisions (referenced by code, dated, durable)
- `docs/codebase-conventions/*.md` — engineering rules (referenced by code)
- `src/<dir>/DOCS.md` — per-domain business rules (slug-anchored, code-referenced)
- `docs/how-to/*.md` — recipes (referenced from CLAUDE.md and codebase-conventions)
- `docs/seo/*.md` — SEO program playbook (referenced from #222)
- `docs/domain/ubiquitous-language.md` — canonical terms (referenced from CLAUDE.md)
- `memory/feedback-*.md`, `pattern-*.md`, `reference-*.md` (Phase 4 will promote the load-bearing ones to `docs/codebase-conventions/`; meanwhile they stay)

**The recursive irony:** this spec itself lives at `docs/superpowers/specs/2026-05-21-gh-issue-management-design.md` and is in the "dies" list. It will be deleted when the implementation epic closes — its content either crystallizes into `docs/codebase-conventions/github-workflow.md` (the canonical spec) or lives on as the closed implementation epic's body in GitHub.
