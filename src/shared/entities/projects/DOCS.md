# Projects — Business Rules

A **Project** is a signed contract — the business symbol of a converted customer. Projects are created exclusively from approved proposals (one per birthing meeting) and own the post-signing lifecycle (install → inspection → payment → close).

Projects also serve as the public **portfolio** when `isPublic = true` — the marketing site reads them as case studies. Both purposes share the same row.

This directory holds: schemas (`schemas/`), types (`types.ts`), constants (action configs, `lib/constants.ts`), columns registry (`lib/columns-registry.tsx`), and action-config hooks (`hooks/`). Project DAL currently lives in `features/project-management/dal/server/` and the tRPC router is **not yet migrated** to the entity server system (see `#migration-status`).

## Relationships

```
                                 (one approved-initial-sale proposal mints the project)
Customer ──► Meeting ──► Proposal ──► Project ──► x_projectScopes
              │                          ▲
              └── projectId ─────────────┘ (set on conversion)
                                           │
                                           └── Media files (before/after pairs, gallery)
```

## Lifecycle

`pipelineStage` is the real operational axis; the coarse **status bucket** is
*derived* from it, never stored (see `#status-derived-from-pipeline-stage`).

```
pipelineStage:  signed → opened → pending_inspection → install_complete →
                pending_final_inspection → passed_final →
                got_partial_payment → got_full_payment → closed
                                                (+ on_hold / cancelled side-states)

derived bucket: └───────────── active ─────────────┘   completed (closed)
                on_hold  ←  on_hold stage      cancelled  ←  cancelled stage
```

The stage is the lifecycle; it does NOT sit "within" a status. The old
`projects.status` column (`active | completed | on_hold`) was **removed** (#283):
it defaulted to `active`, never advanced, and couldn't express `cancelled`, so it
lied. A project's coarse state is now **derived** from `pipelineStage` via
`deriveProjectStatusBucket`, never stored.

## Rules

### projects-created-from-approved-proposals-only

A project is created exclusively through the `create` business mutation, which requires:

1. The meeting must have at least one proposal (validated at handler entry)
2. The customer must exist
3. The meeting is linked to the new project (`meetings.projectId`)
4. The meeting outcome flips to `converted_to_project`
5. Scope IDs are extracted from proposals' `projectJSON.data.sow` and inserted into `x_project_scopes`

**Why**: a project represents revenue commitment; without an approved proposal there's no contract basis. The proposal-approval flow IS the trigger; manual project creation is gated by this validation.
**Reference impl**: `src/trpc/routers/projects.router/business.router.ts:create`
**Enforced by**: handler-side TRPCError on missing proposals; convention (no other code path creates projects)

### one-project-per-birthing-meeting

By construction, each project has exactly one birthing meeting (the meeting whose approved `initial-sale` proposal minted it). The unique index on proposals (`proposals_one_approved_initial_sale_per_meeting_idx`) transitively enforces this — see `../proposals/DOCS.md#one-approved-initial-sale-per-meeting`.

Subsequent `additional-work` proposals on the same project live on the same birthing meeting; new meetings on the project (e.g., site visits during install) are typed `Project` and don't mint new projects.

**Why**: the project lineage anchors on the meeting that produced the initial signed contract. Branching projects from arbitrary meetings would break the additional-work accumulation model.
**Reference impl**: `../proposals/DOCS.md#one-approved-initial-sale-per-meeting` (DB constraint)
**Enforced by**: Postgres (via the proposals unique index)

### accessor-is-url-slug

`projects.accessor` is a unique URL-safe slug used for public portfolio pages (`/portfolio/[accessor]`). Generated server-side at creation as `<title-slug>-<6-char-random>`.

**Why**: portfolio URLs must be human-readable but globally unique. Title-only collides (two "Bathroom Remodel" projects); random suffix avoids that without exposing an internal UUID.
**Reference impl**: `src/trpc/routers/projects.router/business.router.ts:create` (slug generation)
**Enforced by**: DB unique constraint on `accessor`

### address-snapshot-from-customer-on-create

At project creation, the address fields (`address`, `city`, `state`, `zip`) are **snapshot from the customer** at that moment. Later customer-address changes do NOT cascade to the project.

**Why**: the project address is the install site at contract time; if a customer moves mid-project, the install site doesn't move with them. (For projects, the address is the property under construction, not the customer's mailing address.)
**Reference impl**: `business.router.ts:create` (snapshot at lines 50–54)
**Enforced by**: convention (no sync code exists; address is independent post-creation)

### pipeline-stage-on-project-not-meeting

A project's `pipelineStage` (text column, **nullable, no DB default**) tracks the post-signing operational sequence. App code sets `signed` at creation (`business.router.ts:create`); a raw insert would leave it NULL, so readers must treat NULL as unset (→ `active`, per `deriveProjectStatusBucket`). This is **distinct** from `meetings.pipeline` (the sales kanban bucket) and `customers.pipelineStage` (lead-funnel stage).

Project pipeline stages (`projectPipelineStages` enum):
```
signed → opened → pending_inspection → install_complete →
pending_final_inspection → passed_final →
got_partial_payment → got_full_payment → closed (+ cancelled / on_hold side-states)
```

**Why**: project operations have their own lifecycle that the sales pipeline doesn't capture (inspections, payments, closing). Mixing them into `meetings.pipeline` would conflate sales and project management.
**Reference impl**: `projectPipelineStages` enum in `src/shared/constants/enums/pipelines.ts`
**Enforced by**: convention (text column, not pgEnum; agents move via the project-pipeline kanban)

### status-derived-from-pipeline-stage

A project's coarse **status bucket** (`active | completed | on_hold | cancelled`) is derived from its `pipelineStage` through `PROJECT_STAGE_BUCKET` — the single canonical classifier. Derive on read via `deriveProjectStatusBucket(stage)`; NULL/unknown → `completed` (an unset stage means a pure-portfolio showcase entry — a finished piece of work — see `#pure-portfolio-projects-are-not-real-projects`). Buckets group by pre-derived stage arrays (`ACTIVE_PROJECT_STAGES`, `ON_HOLD_PROJECT_STAGES`, …) spread into `inArray(projects.pipelineStage, …)` predicates — the dashboard Projects module's Active / On hold sections do exactly this.

Do **not** re-encode the stage→bucket relationship anywhere else. The `projects.status` column was **removed** (#283) — status is derived-only, never stored. Query-side grouping goes through the `statusBucket` filter on `crud.list` (expands buckets → stages via `stagesForBuckets`); display-side goes through `deriveProjectStatusBucket`. Mirrors the meetings classifier (`MEETING_OUTCOME_SENTIMENT`).

**Why**: `status` was set once at creation and never maintained, so nearly every project read `active` regardless of its true state. `pipelineStage` is the axis agents actually move, so it's the truthful source; deriving keeps one source of truth and avoids a status-sync mechanism (JIT derivation — see ADR-0005).
**Reference impl**: `PROJECT_STAGE_BUCKET` + `deriveProjectStatusBucket` in `src/shared/constants/enums/pipelines.ts`; consumed by `src/features/agent-dashboard/constants/dashboard-queries.ts` (`activeProjectsInput` / `onHoldProjectsInput`)
**Enforced by**: convention; the `Record<ProjectPipelineStage, …>` type makes the map exhaustive (omitting a stage fails `pnpm tsc`)

### pure-portfolio-projects-are-not-real-projects

A **pure-portfolio project** has **no meetings** linked to it (`meetings.projectId`). Because a real project is only ever minted from an approved proposal on a birthing meeting (`#projects-created-from-approved-proposals-only`), zero meetings means the row was created purely to showcase work on the marketing portfolio — it never ran the signed→closed lifecycle (its `pipelineStage` is NULL). These must be **completely disregarded** in operational lists, analytics, filtering, and aggregations.

The predicate is meeting-existence, NOT a null-stage check — meeting existence is the semantic definition; the null stage is a symptom. Row-level: `isPurePortfolioProject(project)` (`lib/portfolio.ts`) for shapes carrying their meetings. Query-level: `hasAssociatedMeeting()` (`lib/visibility.ts`, an `exists` predicate) + the `excludePortfolio: true` filter on `crud.list` — the dashboard Active / On hold sections set it. This matters especially for omni users, whose visibility scope is otherwise unbounded (non-omni users are already meeting-scoped via `projectParticipationScope`, which implies ≥1 meeting).

**Why**: ~80% of project rows are portfolio-only showcases; counting them as operational projects makes every dashboard/metric read wrong (e.g. an inflated "active" count). Meeting-existence cleanly separates the two populations.
**Reference impl**: `isPurePortfolioProject` (`src/shared/entities/projects/lib/portfolio.ts`), `hasAssociatedMeeting` (`src/shared/entities/projects/lib/visibility.ts`), `excludePortfolio` filter in `src/trpc/routers/projects.router/crud.router.ts`
**Enforced by**: convention (callers opt in via `excludePortfolio`; analytics surfaces must apply the same predicate)

### isPublic-gates-portfolio-visibility

`projects.isPublic` (boolean, default `false`) controls whether the project appears on the public marketing portfolio. Default is private; agents explicitly publish via the portfolio editor.

**Why**: most signed projects are NOT marketing-ready (no photos, no story, mid-construction). Defaulting to private prevents accidental portfolio leakage.
**Reference impl**: column; consumed by `showroom-display.router.ts`
**Enforced by**: column constraint + showroom queries filter by `isPublic = true`

### before-after-pairs-jsonb-shape

`beforeAfterPairsJSON` is an array of `{ beforeId: string, afterId: string }` referencing media-file IDs. Used by the portfolio carousel to render aligned before/after image pairs.

**Why**: photographic comparisons are how customers evaluate construction work. The JSONB structure (rather than a separate table) keeps the order explicit and trivially mutable from the portfolio editor.
**Reference impl**: schema column; `BeforeAfterPairs` type in `schemas/`
**Enforced by**: Zod validation on insert/update

### scope-extraction-from-proposals

On project create, the handler scans all the meeting's proposals' `projectJSON.data.sow` for scope IDs and de-dupes them into `x_project_scopes` join-table rows.

**Why**: a project may aggregate scopes from multiple proposals (initial-sale + additional-work). The portfolio surfaces show "what trades does this project cover" — that's the union of all proposal SOWs.
**Reference impl**: `business.router.ts:create` (lines 70–93)
**Enforced by**: convention (re-extraction on additional-work approval is a future concern)

### ownership-and-customer-cascade

- `customerId` (FK to customers, `onDelete: 'cascade'`) — projects are destroyed when their customer is.
- `ownerId` (FK to user, `onDelete: 'cascade'`) — projects are destroyed when their owning agent is. **Note**: this is the agent who created the project, not the agent currently managing it.

**Why**: customer cascade is correct (no orphan projects). Owner cascade is a defensive choice — in practice, agents are rarely deleted; if they leave, ownership is reassigned beforehand.
**Reference impl**: schema FK clauses
**Enforced by**: Postgres

### migration-status

The projects entity is **not yet migrated** to the Entity Server System (ADR-0002). The current router uses `agentProcedure` directly, inlines `db.select()` / `db.insert()` calls, and lives in `src/trpc/routers/projects.router/`. Project DAL is split between `features/project-management/dal/server/` (legacy location) and inline router code.

Migration order from ADR-0002: Proposal → Customer → Meeting → **Project**. Proposal is done (PR #207). The others, including this entity, are pending.

**Why this matters now**: the business rules above describe what the code does *today*, not what an ideal entity-router implementation would look like. Don't extrapolate the proposals entity's structure (server-spec, dal/server/queries+mutations) onto projects — that's the migration's job.

**Reference impl**: `docs/adr/0002-entity-server-system.md`; the compliance sweep todo (item #13) will surface migration tasks.

## Anti-patterns

- **Creating a project directly via DB insert.** Use the `create` business mutation — it enforces proposal-existence + meeting linkage + scope extraction.
- **Updating the customer's address and expecting the project's to change.** Address is snapshotted at project creation; see `#address-snapshot-from-customer-on-create`.
- **Using a project pipeline stage on a meeting** or vice versa. Three distinct pipeline-stage enums for three distinct lifecycles (customers, meetings, projects).
- **Publishing a project to the portfolio without media + story fields.** `isPublic = true` is intentional, not a default flip.
- **Branching a "second project" off the same birthing meeting.** Use additional-work proposals on the existing project's meeting; don't create a second project.

## See also

- `../proposals/DOCS.md#conversion-trigger` — approval is a precondition, but project creation (this router's `create` mutation) is a separate agent action, not an automatic effect of approval
- `../proposals/DOCS.md#one-approved-initial-sale-per-meeting` — DB constraint that anchors `#one-project-per-birthing-meeting`
- `../meetings/DOCS.md#meeting-pipeline-storage-vs-derived` — `meeting.projectId IS NOT NULL` derives "projects" pipeline
- `../customers/DOCS.md#signed-customer-eq-has-project` — "signed" = has ≥1 project
- ADR-0002 — Entity Server System (target architecture for the pending migration)
- `docs/codebase-conventions/dal-conventions.md` — DAL conventions (target for migration)
- `docs/codebase-conventions/jsonb-columns.md#arrays-of-objects-vs-keyed-objects` — `beforeAfterPairsJSON` array-of-objects shape + write-boundary validation (`#before-after-pairs-jsonb-shape`)
- ADR-0005 — JSONB vs column vs child table (storage-shape decision rule)
