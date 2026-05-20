# Session Handoff — Docs Context-Collapse Migration

**Date**: 2026-05-19
**Branch**: `docs/context-collapse-migration`
**PR**: [#212](https://github.com/OlisDevSpot/tri-pros-website/pull/212)
**Status**: PR opened, awaiting review + merge

This handoff captures everything a new Claude session needs to finish what we started.

---

## TL;DR

We just landed a massive documentation overhaul (165 files, +2.6K / −61.8K lines) that:
1. Killed stale session-artifact graveyards (`docs/superpowers/`, most of `docs/tasks/`, `CONVENTIONS.md`)
2. Introduced **`<dir>/DOCS.md` per business entity / feature** as the canonical home for business rules — slug-anchored, with Why / Reference impl / Enforced by per rule
3. Introduced **`docs/codebase-conventions/`** as the cross-cutting engineering surface
4. Slimmed **CLAUDE.md** from 325 → ~80 lines (pointers only) with a new **Working Principles** section codifying the **ping-on-staleness** rule
5. Wrote **ADR-0003** capturing the 4-tier service/provider architecture decision
6. Fixed a real production bug (phone-gating threshold) discovered during the sweep
7. Produced a **migration punch list** at `docs/plans/entity-server-migration-punch-list.md` for the remaining entity-server-system work

What's left is the long tail: PR review, filing follow-up issues, finishing memory thinning, and starting the actual code migrations the punch list identifies.

---

## What's done in this PR

### Doc structure (new)

| File / Dir | Purpose |
|---|---|
| `CLAUDE.md` (slimmed) | Auto-loaded pointers + Working Principles (trust-but-verify, ping-on-staleness) |
| `docs/README.md` (updated) | Added Engineering quick-reference table |
| `docs/codebase-conventions/README.md` + 8 topic files | Cross-cutting engineering rules: database-schema, enum-standardization, trpc-procedures, dal-conventions, service-architecture, query-toolkit, frontend-stack, environment |
| `docs/adr/0003-service-provider-architecture.md` | 4-tier architecture decision (was only in deleted `docs/superpowers/` + a memory file) |
| `src/shared/entities/proposals/DOCS.md` | **Canonical proof-of-concept**, 15 rules |
| `src/shared/entities/customers/DOCS.md` | 10 rules |
| `src/shared/entities/meetings/DOCS.md` | 11 rules |
| `src/shared/entities/projects/DOCS.md` | 10 rules + migration-status note |
| `src/shared/entities/lead-sources/DOCS.md` | 5 rules |
| `src/trpc/DOCS.md` | Entity Server System operational rules + migration-status table |
| `src/features/proposal-flow/DOCS.md` | Feature-level flow rules (the only feature that earned a DOCS.md) |
| `docs/plans/entity-server-migration-punch-list.md` | Categorized list of remaining migration work; ~5 grouped GitHub issues recommended |

### Deletions
- `docs/superpowers/` — 90+ files (settled in PR #207 / replaced by ADR-0002/0003 / now in `docs/plans/` for active designs)
- `docs/tasks/*` — 11 of 13 (the two with active GH issues — meta-ads, notion-crm — survived, pointing at `docs/plans/`)
- `CONVENTIONS.md` — migrated into `docs/codebase-conventions/`

### Code fixes (surfaced by the doc sweep)
- **`src/shared/entities/customers/lib/phone-gating-sql.ts:29`** — `p.status = 'sent'` (equality) → `p.status IN ('sent', 'approved')` (threshold). Real production bug — agents were losing phone access on contract approval.
- **`src/shared/db/schema/customers.ts:30`** — Removed misleading `@deprecated` on `customers.pipeline`; replaced with accurate description. The column is still source of truth for `rehash`/`dead`.

### Comment audit (done dirs)
- `src/shared/entities/{proposals,customers,meetings,projects,lead-sources}/**` — all multi-paragraph blocks condensed to file-top JSDoc + slug refs
- `src/trpc/lib/**` — same treatment
- Per-line non-obvious WHYs preserved (CSLB holiday-handling, Zoho payload divergence, COALESCE chain rationale, etc.)

### Memory updates (light pass)
- `MEMORY.md` — added banner explaining new docs structure; cross-linked load-bearing entries (phone-visibility, conversion-rules, backend-three-layer, service-layer-naming, visibility-scoping, pagination-toolkit, tanstack-placeholderData, url-helpers, derived-values, tRPC architecture refactor)
- New memory: `feedback-ping-on-staleness.md` codifying the new global rule

---

## What's left to do (prioritized)

### 1. **PR #212 review + merge** (HIGHEST)
The PR is opened. Address any review comments. Once merged, the new docs structure is canonical on main.

### 2. **File the 5 GitHub issues from the punch list** (HIGH)
Source: `docs/plans/entity-server-migration-punch-list.md`. Recommended grouping (already drafted in the file):

1. Migrate Customer entity to entity-server-system (P1)
2. Migrate Meeting entity to entity-server-system (P0 — largest blast radius)
3. Migrate Project entity to entity-server-system (P1)
4. Migrate Lead Sources entity to entity-server-system (P1)
5. Compliance cleanup: services + jobs + lingering standalone DAL files (P2)

Labels: `area:backend`, `type:refactor`, `claude`. Use `gh issue create` with the body pulled from the punch list.

### 3. **Memory audit — comprehensive pass** (MEDIUM)
Only the load-bearing entries in MEMORY.md were cross-linked; **~50 memory files still hold rules that may duplicate canonical DOCS.md / codebase-conventions content.** Surgical pass: for each memory file:

- Does the rule body now live in a canonical doc? → thin to reflection + link
- Is the memory file holding session-specific feedback that doesn't fit DOCS.md? → keep as-is
- Is it referencing dead paths or stale code? → fix or delete

Recommended approach: iterate one file at a time using the established slug-link pattern. Probably one full session.

### 4. **Codebase-wide comment audit** (MEDIUM)
Only the dirs I touched got comment audits. The long tail:
- `src/shared/components/**` — many UI components have prose
- `src/app/**` — page-level prose
- `src/features/**/ui/**` — feature UI components
- `src/shared/lib/**` — utilities
- `scripts/**` — CLI scripts
- `src/shared/services/**` — service files

Approach: spot-check for multi-paragraph `/* */` blocks; condense to file-top JSDoc + slug refs where the rule lives elsewhere. Per-line non-obvious WHYs stay.

### 5. **Entity-server-system migrations** (the actual code work, post-merge)
Once issues from #2 are filed, work them one at a time per the punch list ordering. Each is a separate PR per ADR-0002.

### 6. **Optional feature DOCS.md** (LOW)
`src/features/customer-pipelines/DOCS.md` and `src/features/meeting-flow/DOCS.md` were intentionally skipped — their rules largely live in the entity DOCS.md they consume. Earn-inclusion principle: write them only if ≥3 non-obvious feature-level rules emerge.

---

## Conventions you MUST respect

These are now codified in CLAUDE.md (auto-loaded) and per-DOCS.md. Don't drift:

### Working Principles (CLAUDE.md)
- **Trust but verify**: check code before quoting documented behavior. Docs describe rules as-of-when-written; code is what runs.
- **Ping on staleness**: when docs/memory/comments diverge from code, STOP and tell the user. Format: `"⚠️ Stale ref — <doc>:<line> says X, but code at <path> does Y."` Then propose a fix. Don't silently work around. Especially for business rules.
- Codified in `memory/feedback-ping-on-staleness.md`.

### DOCS.md format
- **Slug-anchored** rules (`#kind-derived-from-meeting-project`), not numbered
- Each rule: one-sentence statement + **Why** / **Reference impl** / **Enforced by** lines
- Sections: Layout / Lifecycle (if applicable) / Rules / Anti-patterns / See also
- Cross-link other DOCS.md files via relative paths + slug anchors

### Code-to-doc references
- Same dir: `// see ./DOCS.md#slug`
- Cross-dir: `// see <path>/DOCS.md#slug`
- Inside the same DOCS.md file: `#slug` (markdown anchor)

### Comment style
- File-top JSDoc: ≤3 lines, optionally pointing at DOCS.md slug
- JSDoc multiline must have `/**` on its own line (lint rule `jsdoc/multiline-blocks`)
- Per-line WHYs only for non-obvious behavior (workarounds, hidden invariants, subtle bug fixes)
- **No multi-paragraph rationale blocks** — that prose belongs in DOCS.md

### Memory pattern
- Memory files are personal **reflections** + canonical-doc links — NOT rule bodies
- Format: a memory file points at the canonical DOCS.md slug; the body says "we learned this after X happened"
- Reference impl: `memory/project-conversion-rules.md` (after the thinning)

### Three doc surfaces
| Surface | Holds | Example |
|---|---|---|
| `docs/adr/` | Decisions (immutable once accepted) | "Why we chose the 4-tier service architecture" |
| `docs/codebase-conventions/` | Cross-cutting engineering rules | "DAL functions return DalReturn<T>" |
| `<dir>/DOCS.md` | Business rules per domain | "Phone visibility threshold is sent-or-approved" |
| `docs/how-to/` | Step-by-step recipes | "How to add a new entity" |
| `memory/` | Personal reflections + links | NOT rule bodies |

### Anti-patterns
- Long prose in DOCS.md — keep rules scannable
- Aspirational rules with no `Reference impl` — that's rot bait
- Duplicating a rule across multiple DOCS.md files — cross-link, don't copy
- Numbered rule refs (`13-D`) — slugs survive reordering
- Memory files holding rule bodies — they hold reflections; rules live in DOCS.md

---

## Critical gotchas (non-obvious things the new session must know)

### Actual enum values

| Enum | Actual values |
|---|---|
| `proposalStatuses` | `['draft', 'sent', 'approved', 'declined']` (NOT `proposal-sent`, NOT `expired` — these are common mistakes from stale memory) |
| `meetingOutcomes` | `selectableMeetingOutcomes ∪ derivedMeetingOutcomes`; derived ones (`proposal_created`, `proposal_sent`, `converted_to_project`) appear but are disabled in dropdowns |
| `pipelines` | 5-bucket: `projects | fresh | leads | rehash | dead` (the customer-facing classification) |
| `customers.pipeline` column | 3-bucket: `active | rehash | dead` (`active` is exploded into projects/fresh/leads by `derivedPipelineSql`) |
| `meetings.pipeline` column | 3-bucket: `fresh | rehash | dead` (`projects` derived from `projectId IS NOT NULL`) |

### Entity-server-system migration status
- **Proposal** → MIGRATED (PR #207) — canonical example at `src/trpc/routers/proposals.router/`
- **Customer / Meeting / Project / Lead Source** → NOT migrated; tracked in punch list
- The punch list has the full breakdown — read it before starting any of those migrations

### Phone-gating bug fix in this PR
- `phone-gating-sql.ts` was checking `p.status = 'sent'` (equality)
- That meant customers with only `approved` proposals lost agent phone access
- Fixed to `p.status IN ('sent', 'approved')` in this PR
- The memory file `feedback-phone-visibility-threshold.md` previously referenced fictional `proposal-sent` / `contract-sent` status names — now corrected

### `customers.pipeline @deprecated` was misleading
- The deprecation comment said it was "moving to meetings.pipeline" — but a dead customer may have no meetings, so the rehash/dead values can't move
- Fixed in this PR; the column is now correctly described as "coarse 3-bucket" with the derived 5-bucket pipeline explained

### Meeting-level `hasSentProposal` is INTENTIONALLY equality
- `meetings.router.ts:132,363` uses `WHERE p.status = 'sent'` — this is paired with `hasApprovedProposal` and intentionally distinguishes the two states
- Not the same as the customer-level `hasSentProposalSql` (which was the buggy one)
- Don't "fix" the meeting-level equality — it's correct

### JSDoc style
- The `jsdoc/multiline-blocks` lint rule requires `/**` on its own line for multiline blocks
- I had to fix several occurrences during this session — be aware

### `pnpm` commands
- **NEVER** `pnpm build` unless explicitly asked (per user feedback `feedback-no-build.md`)
- **NEVER** `pnpm db:push` (production) — use `pnpm db:push:dev`
- Verify with `pnpm tsc` + `pnpm lint`

---

## Files of interest (where the canonical examples live)

- **DOCS.md format reference**: `src/shared/entities/proposals/DOCS.md` (most rules, most polish)
- **Entity Server System reference**: `src/trpc/routers/proposals.router/index.ts` (the only migrated entity)
- **Code-conventions reference**: `docs/codebase-conventions/README.md` (topic index)
- **ADR style reference**: `docs/adr/0003-service-provider-architecture.md` (latest)
- **How-to reference**: `docs/how-to/add-an-entity.md`
- **Slim CLAUDE.md reference**: current `CLAUDE.md` (use as the template for any future trimming)
- **Migration punch list**: `docs/plans/entity-server-migration-punch-list.md`

---

## Recommended first action for the new session

1. **Read `CLAUDE.md`** (auto-loaded) — note the Working Principles section.
2. **Check PR #212 status**: `gh pr view 212 --json state,reviewDecision,statusCheckRollup`
3. If PR is merged: file the 5 follow-up issues from `docs/plans/entity-server-migration-punch-list.md`.
4. If PR is in review: address any comments, push fixes.
5. After 1-4, decide next focus:
   - Memory audit pass (mechanical, doable in one session) — #3 above
   - Comment audit pass for non-entity dirs — #4 above
   - Start the Customer entity migration (largest standalone benefit) — #5 above, smallest of the migrations
