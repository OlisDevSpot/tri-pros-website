# tRPC Entity Server System — Phase 1a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the L0/L1/L2 factory layers + registry + entity-name colocation for the Entity Server System. Pure additive — no existing tRPC procedure is touched; no runtime behavior changes.

**Architecture:** Three layered factories (`createCrudHandlers` → `createCrudRouter` → `createEntityRouter`) live in `src/trpc/lib/`. Each business entity declares a typed `EntityServerSpec` (discriminated union over `parentEntity: null | EntityName`). The Core branch is fully implemented; the Nested branch is dormant (types compile, L0 throws). `domains/permissions/abilities.ts` is refactored to derive `EntityName` / `AppSubject` from per-entity constants colocated at `entities/<entity>/lib/constants.ts`.

**Tech Stack:** TypeScript, tRPC, Drizzle ORM (Postgres), drizzle-zod, Zod, CASL (@casl/ability), better-auth.

**Spec:** [`docs/superpowers/specs/2026-05-15-trpc-entity-server-system-phase-1a-design.md`](../specs/2026-05-15-trpc-entity-server-system-phase-1a-design.md)
**ADR:** [`docs/adr/0002-entity-server-system.md`](../../adr/0002-entity-server-system.md)
**How-to:** [`docs/how-to/add-an-entity.md`](../../how-to/add-an-entity.md)

**Verification model (no test runner in this project):** Each task verifies via `pnpm tsc` (TypeScript compilation) and `pnpm lint` (ESLint). "TDD" is adapted to type-level: probes intentionally violate the type contract → `pnpm tsc` fails → write minimal code → `pnpm tsc` passes → delete probe → commit. Final task is manual smoke (load dashboard, exercise CASL).

**Memory pin:** Per `feedback-no-build.md`, NEVER run `pnpm build`. Verification is `pnpm tsc` + `pnpm lint` only.

**File structure (everything created or modified):**

```
src/trpc/lib/                                                  ← NEW
├── types.ts                       # EntityServerSpec union, AgentCtx, SlotName, CrudHandlers
├── entity-registry.ts             # entityRegistry + registerEntity()
├── build-agent-ctx.ts             # internal helper consumed by L1
├── create-crud-handlers.ts        # L0: returns CrudHandlers<Spec>
├── create-crud-router.ts          # L1: TS-refuses NestedEntitySpec; reads spec.shareable
└── create-entity-router.ts        # L2: registers spec, auto-plugs L1, mounts plugins

src/shared/entities/customers/lib/constants.ts                 # NEW: export const CUSTOMER  = 'Customer'  as const
src/shared/entities/meetings/lib/constants.ts                  # NEW: export const MEETING   = 'Meeting'   as const
src/shared/entities/proposals/lib/constants.ts                 # NEW: export const PROPOSAL  = 'Proposal'  as const
src/shared/entities/projects/lib/constants.ts                  # NEW: export const PROJECT   = 'Project'   as const

src/shared/domains/permissions/types.ts                        # MODIFY: AppSubjects→AppSubject, AppActions→AppAction, derive from EntityName
src/shared/domains/permissions/abilities.ts                    # MODIFY: import constants, derive ENTITY_NAMES, export EntityName
```

---

## Task 1: Entity-name constants

**Purpose:** Each entity declares its canonical identity string at one fixed location. These constants are the source of truth from which `ENTITY_NAMES` / `EntityName` / `AppSubject` are derived in Task 2.

**Files:**
- Create: `src/shared/entities/customers/lib/constants.ts`
- Create: `src/shared/entities/meetings/lib/constants.ts`
- Create: `src/shared/entities/proposals/lib/constants.ts`
- Create: `src/shared/entities/projects/lib/constants.ts`

- [ ] **Step 1.1: Write `customers/lib/constants.ts`**

`src/shared/entities/customers/lib/constants.ts`:

```ts
// Canonical entity-name constant for the Customer entity. Source of truth
// for `EntityName` and `AppSubject` (see domains/permissions/abilities.ts).
// Adding a new entity? Mirror this file under your entity's lib/ and add
// the import + ENTITY_NAMES entry in abilities.ts.
export const CUSTOMER = 'Customer' as const
```

- [ ] **Step 1.2: Write `meetings/lib/constants.ts`**

`src/shared/entities/meetings/lib/constants.ts`:

```ts
// Canonical entity-name constant for the Meeting entity. Source of truth
// for `EntityName` and `AppSubject` (see domains/permissions/abilities.ts).
export const MEETING = 'Meeting' as const
```

- [ ] **Step 1.3: Write `proposals/lib/constants.ts`**

`src/shared/entities/proposals/lib/constants.ts`:

```ts
// Canonical entity-name constant for the Proposal entity. Source of truth
// for `EntityName` and `AppSubject` (see domains/permissions/abilities.ts).
export const PROPOSAL = 'Proposal' as const
```

- [ ] **Step 1.4: Write `projects/lib/constants.ts`**

`src/shared/entities/projects/lib/constants.ts`:

```ts
// Canonical entity-name constant for the Project entity. Source of truth
// for `EntityName` and `AppSubject` (see domains/permissions/abilities.ts).
export const PROJECT = 'Project' as const
```

- [ ] **Step 1.5: Verify `pnpm tsc` clean**

Run: `pnpm tsc`
Expected: no errors. These files are pure isolated `const` declarations — they can't break anything.

- [ ] **Step 1.6: Verify `pnpm lint` clean**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 1.7: Commit**

```bash
git add src/shared/entities/customers/lib/constants.ts \
        src/shared/entities/meetings/lib/constants.ts \
        src/shared/entities/proposals/lib/constants.ts \
        src/shared/entities/projects/lib/constants.ts
git commit -m "$(cat <<'EOF'
refactor(entities): colocate entity-name constants per ADR-0002

Each business entity now declares its canonical identity string at
entities/<entity>/lib/constants.ts. These constants are imported by
domains/permissions/abilities.ts in the next commit to derive
ENTITY_NAMES, EntityName, and AppSubject — replacing the hand-maintained
union of string literals.

Pure additive. No imports yet.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Refactor `abilities.ts` + `types.ts` to derive from constants

**Purpose:** Replace the hand-maintained `AppSubjects` string-literal union with a derived `AppSubject` type. `ENTITY_NAMES` and `EntityName` come from the four constants imported from `entities/<entity>/lib/`. `AppSubjects` → `AppSubject` and `AppActions` → `AppAction` renames also happen here (singular form matches ADR-0002 vocabulary).

**Files:**
- Modify: `src/shared/domains/permissions/types.ts` (entire file rewritten)
- Modify: `src/shared/domains/permissions/abilities.ts` (imports + new exports; rule bodies unchanged)
- Modify: (Task 2.5) any callers of the old `AppSubjects` / `AppActions` plural names

- [ ] **Step 2.1: Probe — confirm the rename is detectable**

Run: `grep -rn 'AppSubjects\b\|AppActions\b' src/ --include='*.ts' --include='*.tsx' | head`

Expected: at least one match (the type definition in `permissions/types.ts`, plus any consumers). Note them — they'll need to be renamed.

- [ ] **Step 2.2: Rewrite `permissions/types.ts`**

`src/shared/domains/permissions/types.ts`:

```ts
// ─── CASL Permission Types ──────────────────────────────────────────────────
// These types define the shape of our permission system.
// `AppAbility` is the main type used everywhere — it's a CASL Ability
// parameterized with our specific actions and subjects.
//
// Subjects derive from per-entity constants:
//   - `EntityName` (4 business entities) comes from `abilities.ts`, which
//     imports each entity's identity from `entities/<entity>/lib/constants.ts`.
//   - The non-entity subjects below are feature/route gates that aren't
//     real business entities — they stay hand-maintained.

import type { MongoAbility } from '@casl/ability'

import type { EntityName } from './abilities'

// Actions a user can perform.
// 'manage' is CASL's built-in wildcard — means "all actions".
// 'access' is our custom action for route/feature gating (e.g., Dashboard).
// 'assign' is our custom action for reassigning ownership (e.g., meeting owner).
export type AppAction = 'access' | 'assign' | 'create' | 'delete' | 'manage' | 'read' | 'update'

// Subjects (resources) that actions apply to.
// `EntityName` covers the 4 business entities (Customer/Meeting/Proposal/Project).
// The rest are non-entity feature gates that stay hand-maintained:
//   - 'all'              CASL built-in wildcard
//   - 'Dashboard'        route-level gate (dashboard access)
//   - 'Calendar'         feature gate (GCal sync)
//   - 'CustomerPipeline' feature gate (manage rehash/dead pipeline access)
//   - 'Activity'         activity-log entity (no Entity Server System integration yet)
export type AppSubject =
  | EntityName
  | 'all'
  | 'Activity'
  | 'Calendar'
  | 'CustomerPipeline'
  | 'Dashboard'

// The main ability type used throughout the app.
// MongoAbility is CASL's default ability class — named "Mongo" for historical
// reasons but works with any backend. It's just the standard CASL ability.
export type AppAbility = MongoAbility<[AppAction, AppSubject]>
```

- [ ] **Step 2.3: Modify `permissions/abilities.ts`**

Edit `src/shared/domains/permissions/abilities.ts`. **Only the top of the file changes** — imports + new `ENTITY_NAMES`/`EntityName` exports. The `defineAbilitiesFor` body is unchanged because the string literals `'Customer'`, `'Meeting'`, etc., are still members of the new derived `EntityName` ⊂ `AppSubject` union.

Replace the existing file header (lines 1–27, ending at the `interface PermissionUser` line) with:

```ts
// ─── CASL Ability Definitions ───────────────────────────────────────────────
// This is THE single source of truth for permissions in the app.
// Both server (tRPC procedures) and client (React components) import this
// same function, so permissions are always in sync.
//
// HOW TO READ THIS:
// - Each role gets a block of `can(action, subject)` calls
// - `can('manage', 'all')` = can do everything (super-admin shorthand)
// - Conditions like `{ id: user.id }` restrict to "own" resources
//
// HOW TO EXTEND:
// - New entity? Add its identity constant at `entities/<entity>/lib/constants.ts`,
//   import it below, and add it to ENTITY_NAMES.
// - New non-entity subject (feature/route gate)? Add it to AppSubject in types.ts.
// - New role? Add a new case block below.
// - New action on existing subject? Add a `can()` line to the role.

import type { AppAbility } from './types'

import { AbilityBuilder, createMongoAbility } from '@casl/ability'
import type { UserRole } from '@/shared/constants/enums'

// Per-entity identity constants colocated with the entity. The derived
// `EntityName` union is the entity portion of `AppSubject` — every entity
// here is automatically permittable. Adding a 5th entity is one import +
// one line in ENTITY_NAMES.
import { CUSTOMER } from '@/shared/entities/customers/lib/constants'
import { MEETING } from '@/shared/entities/meetings/lib/constants'
import { PROJECT } from '@/shared/entities/projects/lib/constants'
import { PROPOSAL } from '@/shared/entities/proposals/lib/constants'

export const ENTITY_NAMES = [CUSTOMER, MEETING, PROPOSAL, PROJECT] as const
export type EntityName = (typeof ENTITY_NAMES)[number]

// The user shape we need for permission decisions.
// Intentionally minimal — only id and role. If you need more fields
// for conditions (e.g., departmentId), add them here.
interface PermissionUser {
  id: string
  role: UserRole
}
```

The `defineAbilitiesFor` function body remains exactly as it is today (no changes to rule bodies).

- [ ] **Step 2.4: Run `pnpm tsc` to surface rename fallout**

Run: `pnpm tsc 2>&1 | head -30`
Expected: errors at any file that imports `AppSubjects` or `AppActions` (plural). Each error tells you the file + line to fix. Note the list of files.

- [ ] **Step 2.5: Rename consumer imports**

For every file flagged in Step 2.4, edit it to use the new singular names:

- `AppSubjects` → `AppSubject`
- `AppActions` → `AppAction`

If the grep in Step 2.1 found additional non-import call sites (e.g. a variable typed as `AppSubjects[]`), rename those too.

- [ ] **Step 2.6: Run `pnpm tsc` clean**

Run: `pnpm tsc`
Expected: zero errors. The whole codebase compiles with the new derivation.

- [ ] **Step 2.7: Run `pnpm lint` clean**

Run: `pnpm lint`
Expected: zero errors.

- [ ] **Step 2.8: Manual sanity-check — verify CASL rules still apply**

Start `pnpm dev` (port 3002 per `CLAUDE.local.md`). Visit `/dashboard` as a logged-in agent. Confirm the dashboard loads — proves `defineAbilitiesFor` returns a working ability for the `agent` role.

If the dashboard fails to load with an "ability is not a function" or similar runtime error, the abilities.ts rewrite broke something. Read your diff against `git diff src/shared/domains/permissions/abilities.ts` — the rule bodies must be byte-identical to before the rewrite.

Stop the dev server before moving on.

- [ ] **Step 2.9: Commit**

```bash
git add src/shared/domains/permissions/types.ts \
        src/shared/domains/permissions/abilities.ts \
        $(git diff --name-only -- '*.ts' '*.tsx' | grep -v '^src/shared/domains/permissions/' || true)
git commit -m "$(cat <<'EOF'
refactor(permissions): derive EntityName + AppSubject from entity constants

abilities.ts now imports the four entity-identity constants
(CUSTOMER/MEETING/PROPOSAL/PROJECT) from each entity's lib/constants.ts
and derives ENTITY_NAMES (const array) + EntityName (union type).

types.ts AppSubjects→AppSubject (singular, per ADR-0002 vocabulary),
AppActions→AppAction. AppSubject = EntityName | 'all' | non-entity
feature gates (Dashboard, Calendar, CustomerPipeline, Activity).

Pure type-level refactor. defineAbilitiesFor rule bodies unchanged —
string literals like 'Customer' still typecheck because they're members
of the new derived union.

Issue #193.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `src/trpc/lib/types.ts` — type contract

**Purpose:** The single source of truth for `EntityServerSpec`, `AgentCtx`, `SlotName`, `CrudHandlers`, and the helper row-shape aliases. No runtime code — just types. Other factory files import from here.

**Files:**
- Create: `src/trpc/lib/types.ts`

- [ ] **Step 3.1: Write `types.ts`**

`src/trpc/lib/types.ts`:

```ts
// ─── Entity Server System — Shared Types ────────────────────────────────────
// Type contract consumed by L0 (create-crud-handlers), L1 (create-crud-router),
// L2 (create-entity-router), and the entity registry.
//
// See ADR-0002 (docs/adr/0002-entity-server-system.md) for design rationale
// and the Phase 1a spec (docs/superpowers/specs/...) for scope and policy.

import type { MongoAbility } from '@casl/ability'
import type { SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'
import type z from 'zod'

import type { BetterAuthSession } from '@/shared/domains/auth/server'
import type { AppSubject, EntityName } from '@/shared/domains/permissions/types'

export type AppAbility = MongoAbility<[
  'access' | 'assign' | 'create' | 'delete' | 'manage' | 'read' | 'update',
  AppSubject,
]>

/**
 * Canonical CRUD slot names. Used by the L1 `exclude` option and by
 * `CrudHandlers` to key its slot functions.
 */
export type SlotName = 'list' | 'getById' | 'create' | 'update' | 'delete' | 'duplicate'

/**
 * Framework-agnostic context that every L0 handler receives. Session is
 * always present — L1's `shareable` token path takes a separate branch
 * that bypasses L0 entirely (no session, no scope, just a token match).
 */
export interface AgentCtx {
  session: BetterAuthSession
  ability: AppAbility
  /** Visibility SQL fragment to apply to reads. `null` = omni / no scoping. */
  scope: SQL | null
}

// ── Helper row-shape aliases ─────────────────────────────────────────────
// Row, Insert, Update derived from the Drizzle table's $infer* properties.
// This keeps the spec compact — entities don't have to thread row types
// through every generic parameter; the factory pulls them from the table.

export type Row<TTable extends PgTable> = TTable['$inferSelect']
export type Insert<TTable extends PgTable> = TTable['$inferInsert']
export type Update<TTable extends PgTable> = Partial<TTable['$inferInsert']>

// ── Shared spec base — both branches have these fields with the same shape ─

interface EntitySpecBase<TTable extends PgTable = PgTable> {
  entityName: EntityName
  table: TTable
  schemas: {
    insert: z.ZodTypeAny
    update: z.ZodTypeAny
    select: z.ZodTypeAny
  }
  /** Defaults to 'id'. Override for serial PKs or custom column names. */
  primaryKey?: string

  // Named typed config — all optional. Promote new patterns here only when
  // 2+ entities adopt them (per ADR-0002 "one-adopter-not-a-seam" rule).
  shareable?: { tokenColumn: string }
  update?: { jsonbMergeColumns: readonly PgColumn[] }
  list?: {
    searchColumns?: readonly PgColumn[]
    sortableColumns?: Record<string, PgColumn>
    defaultSort?: { column: string, dir: 'asc' | 'desc' }
  }
}

// ── Core branch ──────────────────────────────────────────────────────────
//
// `parentEntity: null` is the discriminant. Core entities REQUIRE
// `caslSubject` and `visibility` — they're root-level identities.

export interface CoreEntitySpec<TTable extends PgTable = PgTable> extends EntitySpecBase<TTable> {
  parentEntity: null
  caslSubject: AppSubject
  visibility: (userId: string) => SQL
}

// ── Nested branch ────────────────────────────────────────────────────────
//
// DORMANT in Phase 1a — types compile, but no entity uses this branch yet.
// Policy: all new entities MUST be authored as `CoreEntitySpec`. Reach for
// `NestedEntitySpec` only when a concrete consumer emerges that genuinely
// requires parent-chain auth inheritance, and revisit the design with the
// consumer in hand.
//
// When that day comes:
//   - `parentEntity` is a non-null EntityName (parent must already exist
//     in the registry at module load time).
//   - `parentRef` is the FK on THIS table pointing at the parent.
//   - `caslSubject` and `visibility` default to inherited from parent chain;
//     override locally if this nested entity has genuinely different rules.

export interface NestedEntitySpec<TTable extends PgTable = PgTable> extends EntitySpecBase<TTable> {
  parentEntity: EntityName
  parentRef: { foreignKey: PgColumn }
  caslSubject?: AppSubject
  visibility?: (userId: string) => SQL
}

export type EntityServerSpec = CoreEntitySpec | NestedEntitySpec

// ── L0 handler shape ─────────────────────────────────────────────────────
//
// Each slot is `(ctx, input) => Promise<output>`. Pure async functions, no
// tRPC dependency, throw domain errors (`new Error('NotFound')` etc.) which
// L1 maps to TRPCError. `list` input is the standard paginated-query shape.

export interface ListInput {
  pagination: { limit: number, offset: number }
  sort?: { sortBy?: string, sortDir?: 'asc' | 'desc' }
  search?: string
  filters?: Record<string, unknown>
}

export interface PaginatedResult<T> {
  rows: T[]
  total: number
}

export interface CrudHandlers<TTable extends PgTable> {
  list: (ctx: AgentCtx, input: ListInput) => Promise<PaginatedResult<Row<TTable>>>
  getById: (ctx: AgentCtx, input: { id: string }) => Promise<Row<TTable> | undefined>
  create: (ctx: AgentCtx, input: Insert<TTable>) => Promise<Row<TTable>>
  update: (ctx: AgentCtx, input: { id: string, data: Update<TTable> }) => Promise<Row<TTable> | undefined>
  delete: (ctx: AgentCtx, input: { id: string }) => Promise<void>
  duplicate: (ctx: AgentCtx, input: { id: string }) => Promise<Row<TTable>>
}
```

- [ ] **Step 3.2: Verify `pnpm tsc` clean**

Run: `pnpm tsc`
Expected: zero errors. `types.ts` is pure declarations — should compile in isolation.

- [ ] **Step 3.3: Verify `pnpm lint` clean**

Run: `pnpm lint`
Expected: zero errors.

- [ ] **Step 3.4: Commit**

```bash
git add src/trpc/lib/types.ts
git commit -m "$(cat <<'EOF'
feat(trpc): scaffold Entity Server System type contract

Adds src/trpc/lib/types.ts: the shared types for the L0/L1/L2 factory
layers — EntityServerSpec discriminated union (CoreEntitySpec |
NestedEntitySpec), AgentCtx, SlotName, CrudHandlers, ListInput,
PaginatedResult, and Row/Insert/Update helper aliases derived from
Drizzle's table $infer* properties.

NestedEntitySpec branch is intentionally dormant — types compile,
no entity uses it. All new entities must be CoreEntitySpec until a
concrete nested consumer emerges (see ADR-0002 + Phase 1a spec).

Issue #193.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `src/trpc/lib/entity-registry.ts` — load-time registry

**Purpose:** Shared mutable map from `EntityName` → `EntityServerSpec`. Populated by `createEntityRouter` as a side-effect at module load. Phase 1a ships empty (no entity calls L2 yet). Phase 1b's Proposal migration adds the first entry.

**Files:**
- Create: `src/trpc/lib/entity-registry.ts`

- [ ] **Step 4.1: Write `entity-registry.ts`**

`src/trpc/lib/entity-registry.ts`:

```ts
// ─── Entity Server Registry ─────────────────────────────────────────────────
// Module-load-time map from EntityName → its EntityServerSpec.
//
// Populated by `createEntityRouter(spec, ...)` as a side-effect: any entity
// whose router is composed via L2 lands here. Used by:
//   - L0 (nested entities resolving their parent chain — dormant in Phase 1a)
//   - Future cross-cutting tooling (openapi gen, admin scaffolds, observability)
//
// The registry is intentionally a plain Partial<Record<...>>: registration is
// not enforced at the type level — that would require module-load
// orchestration. Instead, `createEntityRouter` is the single producer, and
// duplicate registrations throw immediately.

import type { EntityName } from '@/shared/domains/permissions/types'
import type { EntityServerSpec } from './types'

export const entityRegistry: Partial<Record<EntityName, EntityServerSpec>> = {}

/**
 * Register an entity's spec. Called automatically by `createEntityRouter`.
 * Throws on duplicate registration to surface module-load conflicts loudly
 * rather than silently overwriting.
 */
export function registerEntity(spec: EntityServerSpec): void {
  const existing = entityRegistry[spec.entityName]
  if (existing) {
    throw new Error(
      `[entity-registry] Entity '${spec.entityName}' already registered. `
      + `Each entity must call createEntityRouter exactly once.`,
    )
  }
  entityRegistry[spec.entityName] = spec
}
```

- [ ] **Step 4.2: Verify `pnpm tsc` clean**

Run: `pnpm tsc`
Expected: zero errors.

- [ ] **Step 4.3: Verify `pnpm lint` clean**

Run: `pnpm lint`
Expected: zero errors.

- [ ] **Step 4.4: Commit**

```bash
git add src/trpc/lib/entity-registry.ts
git commit -m "$(cat <<'EOF'
feat(trpc): entity-registry — module-load map of EntityName → spec

Adds src/trpc/lib/entity-registry.ts: a Partial<Record<EntityName,
EntityServerSpec>> populated by createEntityRouter at module-load time.
Duplicate registrations throw immediately.

Ships empty in Phase 1a — no entity calls createEntityRouter yet.

Issue #193.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `src/trpc/lib/build-agent-ctx.ts` — internal helper

**Purpose:** Internal helper used by L1 to convert a tRPC procedure ctx into the framework-agnostic `AgentCtx` that L0 expects. Computes the visibility SQL fragment (or `null` for omni) so L0 can apply it uniformly.

**Files:**
- Create: `src/trpc/lib/build-agent-ctx.ts`

- [ ] **Step 5.1: Write `build-agent-ctx.ts`**

`src/trpc/lib/build-agent-ctx.ts`:

```ts
// ─── build-agent-ctx ────────────────────────────────────────────────────────
// Internal helper. Converts a tRPC procedure ctx (session + ability) plus a
// spec into the framework-agnostic AgentCtx that L0 handlers consume.
//
// Visibility resolution:
//   - Omni callers (CASL `manage all`)  → scope = null   (L0 skips scoping)
//   - Non-omni callers                   → scope = spec.visibility(userId)
//
// For NestedEntitySpec (dormant in Phase 1a), the visibility resolver walks
// the parent chain per ADR-0002. Phase 1a only exercises the Core branch.

import type { BetterAuthSession } from '@/shared/domains/auth/server'
import type { AgentCtx, AppAbility, EntityServerSpec } from './types'

interface TRPCAuthedCtx {
  session: BetterAuthSession
  ability: AppAbility
}

export function buildAgentCtx(
  trpcCtx: TRPCAuthedCtx,
  spec: EntityServerSpec,
): AgentCtx {
  const isOmni = trpcCtx.ability.can('manage', 'all')

  if (isOmni) {
    return {
      session: trpcCtx.session,
      ability: trpcCtx.ability,
      scope: null,
    }
  }

  // For CoreEntitySpec: spec.visibility is required, call it directly.
  // For NestedEntitySpec: would walk parent chain (dormant in Phase 1a).
  if (spec.parentEntity === null) {
    return {
      session: trpcCtx.session,
      ability: trpcCtx.ability,
      scope: spec.visibility(trpcCtx.session.user.id),
    }
  }

  // Nested branch — not yet implemented. Phase 1a never reaches this code
  // path at runtime because no NestedEntitySpec is consumed.
  throw new Error(
    `[build-agent-ctx] NestedEntitySpec ('${spec.entityName}') is not yet `
    + 'supported. All Phase 1a entities must be CoreEntitySpec.',
  )
}
```

- [ ] **Step 5.2: Verify `pnpm tsc` clean**

Run: `pnpm tsc`
Expected: zero errors. TypeScript narrows `spec.parentEntity === null` to `CoreEntitySpec` inside the if-branch, so `spec.visibility` is callable there.

- [ ] **Step 5.3: Verify `pnpm lint` clean**

Run: `pnpm lint`
Expected: zero errors.

- [ ] **Step 5.4: Commit**

```bash
git add src/trpc/lib/build-agent-ctx.ts
git commit -m "$(cat <<'EOF'
feat(trpc): build-agent-ctx — tRPC ctx → AgentCtx adapter

Adds src/trpc/lib/build-agent-ctx.ts: the internal helper that L1 uses
to bridge a tRPC procedure's session+ability into the framework-agnostic
AgentCtx that L0 handlers consume. Resolves the visibility scope SQL
fragment from the spec; null for omni callers.

NestedEntitySpec path throws — Phase 1a never reaches it (Core only).

Issue #193.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `src/trpc/lib/create-crud-handlers.ts` (L0)

**Purpose:** L0 — raw async CRUD functions for any `CoreEntitySpec`. Framework-agnostic, no tRPC dependency. Applies visibility scope to reads, validates schemas on writes, throws domain errors. The Nested branch throws "not yet implemented" — types still compile because the function accepts the discriminated union.

**Files:**
- Create: `src/trpc/lib/create-crud-handlers.ts`

- [ ] **Step 6.1: Write `create-crud-handlers.ts`**

`src/trpc/lib/create-crud-handlers.ts`:

```ts
// ─── createCrudHandlers (L0) ────────────────────────────────────────────────
// Raw CRUD handler functions for a CoreEntitySpec. Returns
// CrudHandlers<TTable> with list/getById/create/update/delete/duplicate.
//
// Composable from anywhere: business plugins (L2), RSC paths, jobs, scripts.
// No tRPC dependency. Throws domain errors (Error('NotFound'), etc.) which
// L1 maps to TRPCError.
//
// Phase 1a scope:
//   - Core branch: fully implemented
//   - Nested branch: throws — first nested consumer will pressure-test parent-chain resolution

import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'
import type {
  AgentCtx,
  CoreEntitySpec,
  CrudHandlers,
  EntityServerSpec,
  Insert,
  ListInput,
  PaginatedResult,
  Row,
  Update,
} from './types'

import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/shared/db'

import { paginate } from '@/shared/dal/server/query/output'
import { buildOrderBy } from '@/shared/dal/server/query/sort'
import { buildSearchWhere } from '@/shared/dal/server/query/search'

/**
 * L0 factory. For a CoreEntitySpec, returns fully-wired CRUD handlers that
 * apply visibility scoping uniformly. For a NestedEntitySpec, returns a
 * placeholder set of handlers that throw — Phase 1a doesn't implement
 * Nested L0 until a real consumer surfaces.
 */
export function createCrudHandlers<TTable extends PgTable>(
  spec: EntityServerSpec & { table: TTable },
): CrudHandlers<TTable> {
  if (spec.parentEntity !== null) {
    return makeNestedPlaceholder(spec.entityName)
  }
  return makeCoreHandlers(spec as CoreEntitySpec<TTable>)
}

// ── Core handlers ────────────────────────────────────────────────────────

function makeCoreHandlers<TTable extends PgTable>(
  spec: CoreEntitySpec<TTable>,
): CrudHandlers<TTable> {
  const pkColumn = getPkColumn(spec)

  return {
    list: async (ctx, input) => listImpl(spec, ctx, input),
    getById: async (ctx, input) => getByIdImpl(spec, pkColumn, ctx, input),
    create: async (ctx, input) => createImpl(spec, ctx, input),
    update: async (ctx, input) => updateImpl(spec, pkColumn, ctx, input),
    delete: async (ctx, input) => deleteImpl(spec, pkColumn, ctx, input),
    duplicate: async (ctx, input) => duplicateImpl(spec, pkColumn, ctx, input),
  }
}

// ── list ─────────────────────────────────────────────────────────────────
//
// Composes visibility scope + search-by-spec-columns + sort-by-spec-columns.
// `input.filters` is intentionally ignored in Phase 1a — entity-specific
// filter predicates require either a v2 spec field or an L2 plugin override.
// No entity consumes the factory in Phase 1a, so this gap is deliberate.

async function listImpl<TTable extends PgTable>(
  spec: CoreEntitySpec<TTable>,
  ctx: AgentCtx,
  input: ListInput,
): Promise<PaginatedResult<Row<TTable>>> {
  const visibilityWhere = ctx.scope ?? undefined
  const searchWhere = spec.list?.searchColumns
    ? buildSearchWhere(input.search, [...spec.list.searchColumns])
    : undefined
  const where = and(visibilityWhere, searchWhere)

  const orderBy = buildOrderBy(
    input.sort,
    spec.list?.sortableColumns ?? {},
    resolveDefaultSort(spec),
  )

  const result = await paginate({
    query: () =>
      db
        .select()
        .from(spec.table as PgTable)
        .where(where)
        .orderBy(...orderBy)
        .limit(input.pagination.limit)
        .offset(input.pagination.offset),
    count: () => db.$count(spec.table as PgTable, where),
  })

  return result as PaginatedResult<Row<TTable>>
}

// ── getById ──────────────────────────────────────────────────────────────

async function getByIdImpl<TTable extends PgTable>(
  spec: CoreEntitySpec<TTable>,
  pkColumn: PgColumn,
  ctx: AgentCtx,
  input: { id: string },
): Promise<Row<TTable> | undefined> {
  const where = and(eq(pkColumn, input.id), ctx.scope ?? undefined)
  const [row] = await db
    .select()
    .from(spec.table as PgTable)
    .where(where)
    .limit(1)
  return row as Row<TTable> | undefined
}

// ── create ───────────────────────────────────────────────────────────────
//
// L0 validates with spec.schemas.insert and inserts. Visibility scope is NOT
// applied to create (you're inserting a new row that doesn't exist yet).
// Ownership-bounded create logic (e.g. "auto-assign owner = current user")
// is the business plugin's responsibility, not L0's.

async function createImpl<TTable extends PgTable>(
  spec: CoreEntitySpec<TTable>,
  _ctx: AgentCtx,
  input: Insert<TTable>,
): Promise<Row<TTable>> {
  const validated = spec.schemas.insert.parse(input) as Insert<TTable>
  const [row] = await db
    .insert(spec.table as PgTable)
    .values(validated)
    .returning()
  if (!row) {
    throw new Error('CreateFailed')
  }
  return row as Row<TTable>
}

// ── update ───────────────────────────────────────────────────────────────
//
// Validates with spec.schemas.update. Applies visibility scope so a
// non-omni caller can't update a row they can't see. JSONB merge per
// spec.update.jsonbMergeColumns is intentionally NOT implemented in Phase
// 1a — the existing per-entity updateProposal/updateCustomer paths cover
// the current consumers; the factory's update is a plain SET. Phase 1b
// adds JSONB-merge when Proposal needs it.

async function updateImpl<TTable extends PgTable>(
  spec: CoreEntitySpec<TTable>,
  pkColumn: PgColumn,
  ctx: AgentCtx,
  input: { id: string, data: Update<TTable> },
): Promise<Row<TTable> | undefined> {
  const validated = spec.schemas.update.parse(input.data) as Update<TTable>
  const where = and(eq(pkColumn, input.id), ctx.scope ?? undefined)
  const [row] = await db
    .update(spec.table as PgTable)
    .set(validated as Record<string, unknown>)
    .where(where)
    .returning()
  return row as Row<TTable> | undefined
}

// ── delete ───────────────────────────────────────────────────────────────

async function deleteImpl<TTable extends PgTable>(
  spec: CoreEntitySpec<TTable>,
  pkColumn: PgColumn,
  ctx: AgentCtx,
  input: { id: string },
): Promise<void> {
  const where = and(eq(pkColumn, input.id), ctx.scope ?? undefined)
  await db.delete(spec.table as PgTable).where(where)
}

// ── duplicate ────────────────────────────────────────────────────────────
//
// Read the row by id (visibility-scoped), strip the primary key, insert as
// a new row. Returns the inserted row. Entities that need owner reassignment
// or other duplicate-time side effects wrap this in a business plugin.

async function duplicateImpl<TTable extends PgTable>(
  spec: CoreEntitySpec<TTable>,
  pkColumn: PgColumn,
  ctx: AgentCtx,
  input: { id: string },
): Promise<Row<TTable>> {
  const source = await getByIdImpl(spec, pkColumn, ctx, input)
  if (!source) {
    throw new Error('NotFound')
  }
  const pkName = spec.primaryKey ?? 'id'
  const { [pkName]: _droppedPk, ...rest } = source as Record<string, unknown>
  const [row] = await db
    .insert(spec.table as PgTable)
    .values(rest as Record<string, unknown>)
    .returning()
  if (!row) {
    throw new Error('DuplicateFailed')
  }
  return row as Row<TTable>
}

// ── helpers ──────────────────────────────────────────────────────────────

function getPkColumn<TTable extends PgTable>(
  spec: CoreEntitySpec<TTable>,
): PgColumn {
  const pkName = spec.primaryKey ?? 'id'
  const table = spec.table as unknown as Record<string, PgColumn>
  const column = table[pkName]
  if (!column) {
    throw new Error(
      `[create-crud-handlers] Spec for '${spec.entityName}' references primary key `
      + `column '${pkName}' which is not on its table.`,
    )
  }
  return column
}

function resolveDefaultSort<TTable extends PgTable>(
  spec: CoreEntitySpec<TTable>,
) {
  const ds = spec.list?.defaultSort
  if (ds && spec.list?.sortableColumns?.[ds.column]) {
    const col = spec.list.sortableColumns[ds.column]
    return ds.dir === 'asc' ? asc(col) : desc(col)
  }
  // Fall back to primary-key DESC so newest-first is the universal default.
  return desc(getPkColumn(spec))
}

// ── nested-branch placeholder ────────────────────────────────────────────

function makeNestedPlaceholder<TTable extends PgTable>(
  entityName: string,
): CrudHandlers<TTable> {
  const fail = (slot: string) => {
    throw new Error(
      `[create-crud-handlers] NestedEntitySpec ('${entityName}', slot '${slot}') `
      + 'is not implemented in Phase 1a. All entities must be CoreEntitySpec '
      + 'until a concrete nested consumer pressure-tests parent-chain resolution.',
    )
  }
  return {
    list: async () => fail('list') as never,
    getById: async () => fail('getById') as never,
    create: async () => fail('create') as never,
    update: async () => fail('update') as never,
    delete: async () => fail('delete') as never,
    duplicate: async () => fail('duplicate') as never,
  }
}
```

- [ ] **Step 6.2: Verify `pnpm tsc` clean**

Run: `pnpm tsc`
Expected: zero errors. If TS complains about `spec.table as PgTable` casts, that's the trade-off for Drizzle's generic table types — the casts narrow `TTable` (specific table) back to the base `PgTable` for the query builder, which is correct usage.

- [ ] **Step 6.3: Verify `pnpm lint` clean**

Run: `pnpm lint`
Expected: zero errors.

- [ ] **Step 6.4: Commit**

```bash
git add src/trpc/lib/create-crud-handlers.ts
git commit -m "$(cat <<'EOF'
feat(trpc): createCrudHandlers (L0) — raw CRUD slot functions

L0 factory for any CoreEntitySpec. Returns CrudHandlers<TTable> with
list/getById/create/update/delete/duplicate as pure async functions —
framework-agnostic, no tRPC dependency, throws domain errors.

Applies visibility scope (ctx.scope) uniformly to reads, updates, deletes,
and to the read-half of duplicate. Validates writes through
spec.schemas.insert / spec.schemas.update.

Composes with the existing query toolkit (paginate, buildOrderBy,
buildSearchWhere) for list. JSONB-merge and filter-predicate fields are
deferred to Phase 1b alongside the first real consumer.

NestedEntitySpec returns a placeholder handler set that throws on any
slot call — Phase 1a never reaches this branch.

Issue #193.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `src/trpc/lib/create-crud-router.ts` (L1)

**Purpose:** L1 — thin tRPC sub-router over L0. Generic upper-bound `<TSpec extends CoreEntitySpec>` is the type-level forcing function that rejects `NestedEntitySpec`. Reads `spec.shareable` to generate the dual-credential `getById` (baseProcedure accepting `{ id, token? }`). Maps L0 domain errors to TRPCError.

**Files:**
- Create: `src/trpc/lib/create-crud-router.ts`

- [ ] **Step 7.1: Write `create-crud-router.ts`**

`src/trpc/lib/create-crud-router.ts`:

```ts
// ─── createCrudRouter (L1) ──────────────────────────────────────────────────
// Thin tRPC sub-router over L0 handlers. Wraps each slot with:
//   - CASL action gate (action ← slot, subject ← spec.caslSubject)
//   - buildAgentCtx → L0 call → return
//   - domain error → TRPCError mapping
//
// `spec.shareable` rewires `getById` to use baseProcedure (no session
// required) and accept an optional `token`. Token path bypasses scope/CASL
// entirely; session path runs the normal authenticated flow.
//
// Generic upper bound on CoreEntitySpec is the type-level forcing function:
// NestedEntitySpec instances fail to compile when passed in.

import type { PgTable } from 'drizzle-orm/pg-core'
import type { CoreEntitySpec, SlotName } from './types'

import { TRPCError } from '@trpc/server'
import { and, eq } from 'drizzle-orm'
import z from 'zod'

import { db } from '@/shared/db'
import { paginationFieldsSchema, sortFieldsSchema } from '@/shared/dal/server/query/schemas'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
import { agentProcedure, baseProcedure, createTRPCRouter } from '@/trpc/init'

import { buildAgentCtx } from './build-agent-ctx'
import { createCrudHandlers } from './create-crud-handlers'

// Action mapping per slot — fixed (not entity-configurable).
const SLOT_ACTIONS: Record<SlotName, 'read' | 'create' | 'update' | 'delete'> = {
  list: 'read',
  getById: 'read',
  create: 'create',
  update: 'update',
  delete: 'delete',
  duplicate: 'create',
}

interface CreateCrudRouterOptions {
  /** Slots to omit from the surfaced tRPC procedures. L0 still generates them
   *  internally — business plugins can call `handlers.<slot>` directly. */
  exclude?: SlotName[]
}

export function createCrudRouter<TSpec extends CoreEntitySpec<PgTable>>(
  spec: TSpec,
  options: CreateCrudRouterOptions = {},
) {
  const handlers = createCrudHandlers(spec)
  const exclude = new Set(options.exclude ?? [])
  const idSchema = z.object({ id: z.string() })

  const procs: Record<string, unknown> = {}

  if (!exclude.has('list')) {
    procs.list = agentProcedure
      .input(z.object({
        pagination: paginationFieldsSchema,
        sort: sortFieldsSchema.optional(),
        search: z.string().optional(),
        // Filter shape is intentionally unconstrained at L1 in Phase 1a —
        // entities with filter requirements override list via a business
        // plugin until a typed-config solution lands in v2.
        filters: z.record(z.string(), z.unknown()).optional(),
      }))
      .query(async ({ ctx, input }) => {
        assertCan(ctx, 'list', spec)
        const agentCtx = buildAgentCtx(ctx, spec)
        return handlers.list(agentCtx, input)
      })
  }

  if (!exclude.has('getById')) {
    procs.getById = makeGetByIdProcedure(spec, handlers, idSchema)
  }

  if (!exclude.has('create')) {
    procs.create = agentProcedure
      .input(spec.schemas.insert)
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx, 'create', spec)
        const agentCtx = buildAgentCtx(ctx, spec)
        return mapDomainErrors(() => handlers.create(agentCtx, input))
      })
  }

  if (!exclude.has('update')) {
    procs.update = agentProcedure
      .input(z.object({
        id: z.string(),
        data: spec.schemas.update,
      }))
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx, 'update', spec)
        const agentCtx = buildAgentCtx(ctx, spec)
        return mapDomainErrors(() => handlers.update(agentCtx, input))
      })
  }

  if (!exclude.has('delete')) {
    procs.delete = agentProcedure
      .input(idSchema)
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx, 'delete', spec)
        const agentCtx = buildAgentCtx(ctx, spec)
        return mapDomainErrors(() => handlers.delete(agentCtx, input))
      })
  }

  if (!exclude.has('duplicate')) {
    procs.duplicate = agentProcedure
      .input(idSchema)
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx, 'duplicate', spec)
        const agentCtx = buildAgentCtx(ctx, spec)
        return mapDomainErrors(() => handlers.duplicate(agentCtx, input))
      })
  }

  return createTRPCRouter(procs as Parameters<typeof createTRPCRouter>[0])
}

// ── shareable getById ────────────────────────────────────────────────────
//
// When spec.shareable is set, getById accepts an optional token and uses
// baseProcedure (no session required). Token path: short-circuit visibility,
// return row if token matches. Session path: standard authenticated flow.

function makeGetByIdProcedure<TSpec extends CoreEntitySpec<PgTable>>(
  spec: TSpec,
  handlers: ReturnType<typeof createCrudHandlers<TSpec['table']>>,
  idSchema: z.ZodObject<{ id: z.ZodString }>,
) {
  if (!spec.shareable) {
    return agentProcedure
      .input(idSchema)
      .query(async ({ ctx, input }) => {
        assertCan(ctx, 'getById', spec)
        const agentCtx = buildAgentCtx(ctx, spec)
        const row = await handlers.getById(agentCtx, input)
        if (!row) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `${spec.entityName} not found` })
        }
        return row
      })
  }

  const tokenColumn = (spec.table as unknown as Record<string, unknown>)[spec.shareable.tokenColumn]
  if (!tokenColumn) {
    throw new Error(
      `[create-crud-router] spec.shareable.tokenColumn '${spec.shareable.tokenColumn}' `
      + `is not a column on ${spec.entityName}'s table.`,
    )
  }
  const pkName = spec.primaryKey ?? 'id'
  const pkColumn = (spec.table as unknown as Record<string, unknown>)[pkName]
  if (!pkColumn) {
    throw new Error(
      `[create-crud-router] spec.primaryKey '${pkName}' is not a column on `
      + `${spec.entityName}'s table.`,
    )
  }

  return baseProcedure
    .input(z.object({ id: z.string(), token: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      // Token path: anonymous or authenticated, token matches → return row.
      if (input.token) {
        const [row] = await db
          .select()
          .from(spec.table as PgTable)
          .where(and(
            // @ts-expect-error — runtime-validated above; columns are PgColumn at runtime.
            eq(pkColumn, input.id),
            // @ts-expect-error — same.
            eq(tokenColumn, input.token),
          ))
          .limit(1)
        if (!row) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `${spec.entityName} not found` })
        }
        return row
      }

      // Session path: authenticated callers go through normal scope.
      // baseProcedure doesn't add `ability` to ctx (only protectedProcedure
      // does), so we construct one inline from the session's role.
      if (!ctx.session) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'A valid token or authenticated session is required',
        })
      }
      const ability = defineAbilitiesFor({
        id: ctx.session.user.id,
        role: ctx.session.user.role,
      })
      if (!ability.can('read', spec.caslSubject)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `You do not have permission to read ${spec.entityName}`,
        })
      }
      const agentCtx = buildAgentCtx(
        { session: ctx.session, ability },
        spec,
      )
      const row = await handlers.getById(agentCtx, { id: input.id })
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `${spec.entityName} not found` })
      }
      return row
    })
}

// ── helpers ──────────────────────────────────────────────────────────────

function assertCan(
  ctx: { ability: { can: (action: string, subject: string) => boolean } },
  slot: SlotName,
  spec: CoreEntitySpec<PgTable>,
): void {
  const action = SLOT_ACTIONS[slot]
  if (!ctx.ability.can(action, spec.caslSubject)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `You do not have permission to ${action} ${spec.entityName}`,
    })
  }
}

async function mapDomainErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  }
  catch (err) {
    if (err instanceof TRPCError) {
      throw err
    }
    if (err instanceof Error) {
      switch (err.message) {
        case 'NotFound':
          throw new TRPCError({ code: 'NOT_FOUND' })
        case 'Forbidden':
          throw new TRPCError({ code: 'FORBIDDEN' })
        case 'CreateFailed':
        case 'DuplicateFailed':
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: err.message })
        default:
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', cause: err })
      }
    }
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' })
  }
}
```

**Why the shareable session path constructs `ability` inline:** `baseProcedure` exposes `ctx.session` (nullable, set in `createHTTPTRPCContext`) but does NOT add `ctx.ability` — that middleware lives on `protectedProcedure`. The shareable `getById` runs on `baseProcedure` (so anonymous token-holders can read), so it must build the ability itself when a session is present. The non-shareable `getById` keeps using `assertCan` because it runs on `agentProcedure` (which has `ability` already).

- [ ] **Step 7.2: Verify `pnpm tsc` clean**

Run: `pnpm tsc`
Expected: zero errors. If there are type errors on `procs as Parameters<typeof createTRPCRouter>[0]`, drop the cast and pass `procs` directly — tRPC's `createTRPCRouter` accepts a record of procedures.

- [ ] **Step 7.3: Verify `pnpm lint` clean**

Run: `pnpm lint`
Expected: zero errors. `@ts-expect-error` directives on the two `eq(pkColumn, ...)` / `eq(tokenColumn, ...)` lines are intentional — the runtime-validated column references can't be statically narrowed from `unknown`.

- [ ] **Step 7.4: Commit**

```bash
git add src/trpc/lib/create-crud-router.ts
git commit -m "$(cat <<'EOF'
feat(trpc): createCrudRouter (L1) — typed tRPC sub-router over L0

L1 factory: thin tRPC wrapper over L0 CRUD handlers. Each slot is gated
by CASL (action mapped from slot, subject from spec.caslSubject), builds
AgentCtx via buildAgentCtx, calls the L0 handler, maps domain errors to
TRPCError.

Generic upper bound <TSpec extends CoreEntitySpec> is the type-level
forcing function — NestedEntitySpec instances fail to compile.

When spec.shareable is set, getById uses baseProcedure and accepts an
optional token. Token path: visibility/CASL bypassed, return row if
token matches. Session path: construct ability inline (baseProcedure
lacks ctx.ability), enforce read, run standard flow.

`exclude: SlotName[]` option lets callers omit slots from the surfaced
router (L0 still generates them — business plugins can call them).

Issue #193.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `src/trpc/lib/create-entity-router.ts` (L2)

**Purpose:** L2 composer. Registers the spec, auto-mounts L1 under key `crud`, and mounts any plugin factories under their keys. Plugins receive the spec so they can call `createCrudHandlers(spec).<slot>` internally.

**Files:**
- Create: `src/trpc/lib/create-entity-router.ts`

- [ ] **Step 8.1: Write `create-entity-router.ts`**

`src/trpc/lib/create-entity-router.ts`:

```ts
// ─── createEntityRouter (L2) ────────────────────────────────────────────────
// Top-level composer. Takes a CoreEntitySpec and any number of plugin
// factories, registers the spec, auto-mounts the L1 CRUD sub-router under
// key `crud`, and mounts each plugin under its key in the returned router.
//
// Plugin signature: (spec) => Router. Plugins are factories so they can
// reach for `createCrudHandlers(spec)` and compose with L0 slots inside
// their own procedure bodies.
//
// Side effect on call: registerEntity(spec). Duplicate registration throws.

import type { PgTable } from 'drizzle-orm/pg-core'
import type { CoreEntitySpec } from './types'

import { createTRPCRouter } from '@/trpc/init'
import { createCrudRouter } from './create-crud-router'
import { registerEntity } from './entity-registry'

// tRPC routers don't expose a clean public-facing supertype, so we infer
// the plugin return type from createTRPCRouter directly.
type AnyRouter = ReturnType<typeof createTRPCRouter>

type PluginFactory<TSpec> = (spec: TSpec) => AnyRouter

export function createEntityRouter<TSpec extends CoreEntitySpec<PgTable>>(
  spec: TSpec,
  plugins: Record<string, PluginFactory<TSpec>> = {},
) {
  registerEntity(spec)

  const composed: Record<string, AnyRouter> = {
    crud: createCrudRouter(spec) as AnyRouter,
  }

  for (const [key, factory] of Object.entries(plugins)) {
    if (key === 'crud') {
      throw new Error(
        `[create-entity-router] Plugin key 'crud' is reserved. Used by the auto-mounted `
        + `CRUD sub-router for '${spec.entityName}'.`,
      )
    }
    composed[key] = factory(spec)
  }

  return createTRPCRouter(composed)
}
```

- [ ] **Step 8.2: Verify `pnpm tsc` clean**

Run: `pnpm tsc`
Expected: zero errors. The `AnyRouter` type may need adjustment if `createTRPCRouter` returns something exotic — if so, `import type { TRPCRouterRecord } from '@trpc/server'` and adjust.

- [ ] **Step 8.3: Verify `pnpm lint` clean**

Run: `pnpm lint`
Expected: zero errors.

- [ ] **Step 8.4: Commit**

```bash
git add src/trpc/lib/create-entity-router.ts
git commit -m "$(cat <<'EOF'
feat(trpc): createEntityRouter (L2) — top-level composer

L2 factory: takes a CoreEntitySpec + plugin factories, registers the
spec in entityRegistry, auto-mounts L1 under key 'crud', mounts each
plugin under its key. Plugins are (spec) => Router factories so they
can compose with L0 slots via createCrudHandlers(spec).

Reserves the 'crud' plugin key — duplicates throw to surface misuse.

No entity calls this in Phase 1a. Phase 1b's Proposal migration is
the first consumer.

Issue #193.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Forcing-function probe (type-level test, no commit)

**Purpose:** Verify the architectural forcing function actually works — pass a `NestedEntitySpec` to `createCrudRouter` and confirm TypeScript rejects the call. The probe lives temporarily inside the project so it picks up the repo's `tsconfig.json` and path aliases (`@/`). Nothing commits.

**Files:**
- Create (temporary): `src/trpc/lib/__probe.ts`

- [ ] **Step 9.1: Write the probe inside the project**

`src/trpc/lib/__probe.ts`:

```ts
// PROBE — verifies createCrudRouter's <TSpec extends CoreEntitySpec> bound
// rejects NestedEntitySpec at compile time. Run `pnpm tsc` and confirm an
// error references this file's last line. Then delete this file.

import type { NestedEntitySpec } from './types'
import { createCrudRouter } from './create-crud-router'

declare const fakeNestedSpec: NestedEntitySpec

// EXPECTED TS ERROR on the line below: NestedEntitySpec is not assignable
// to CoreEntitySpec because parentEntity is EntityName (non-null), not null.
createCrudRouter(fakeNestedSpec)
```

- [ ] **Step 9.2: Run `pnpm tsc` and confirm the error**

Run: `pnpm tsc 2>&1 | grep -A 2 '__probe'`

Expected output: a TypeScript error pointing at `src/trpc/lib/__probe.ts` of the form:

> `src/trpc/lib/__probe.ts:12:18 - error TS2345: Argument of type 'NestedEntitySpec' is not assignable to parameter of type 'CoreEntitySpec<PgTable>'.`
>   `Types of property 'parentEntity' are incompatible.`
>     `Type '"Activity" | "Calendar" | ...' is not assignable to type 'null'.`

(Exact wording will vary with TS version; the key signal is "is not assignable to parameter of type 'CoreEntitySpec'".)

If you DO NOT see this error, the forcing function is broken. Stop and investigate — the generic upper bound on `createCrudRouter` is the central architectural promise of L1.

- [ ] **Step 9.3: Delete the probe**

```bash
rm src/trpc/lib/__probe.ts
```

- [ ] **Step 9.4: Verify repo `pnpm tsc` clean**

Run: `pnpm tsc`
Expected: zero errors (the probe is gone, the repo tree is unchanged).

(No commit — this task verified architecture, no repo changes.)

---

## Task 10: Final validation gate

**Purpose:** Confirm the full Phase 1a PR is green. Runs the validation gates listed in the spec doc.

**Files:** none

- [ ] **Step 10.1: `pnpm tsc` clean**

Run: `pnpm tsc`
Expected: zero errors.

- [ ] **Step 10.2: `pnpm lint` clean**

Run: `pnpm lint`
Expected: zero errors.

- [ ] **Step 10.3: Confirm no existing tRPC procedure was touched**

Run:

```bash
git diff main..HEAD --name-only -- 'src/trpc/routers/' 'src/app/api/' \
  | grep -v '^$' || echo "OK: no router files touched"
```

Expected: `OK: no router files touched`. If any file under `src/trpc/routers/` or `src/app/api/` shows up, the PR is out of Phase 1a scope — investigate.

- [ ] **Step 10.4: Manual smoke — app still loads**

Start dev server: `PORT=3002 pnpm dev`

Visit `http://localhost:3002/dashboard` (sign in if prompted). Confirm:
- Dashboard loads without console errors
- Side nav renders
- At least one entity screen renders (Customers, Meetings, Proposals, Projects — pick any)

If anything breaks, the most likely culprits are:
1. The `AppSubjects` → `AppSubject` rename missed a call site (rerun the grep from Step 2.1)
2. The `abilities.ts` rule bodies were accidentally modified (compare against `git show main:src/shared/domains/permissions/abilities.ts`)

Stop the dev server: `Ctrl-C`.

- [ ] **Step 10.5: Confirm the commit chain is clean**

Run: `git log --oneline main..HEAD`

Expected: ~7 commits, one per task, all conventional-commit prefixed (`refactor:`, `feat(trpc):`). No fixup commits or amendments.

If the commit chain has noise (typo-fix commits, multiple commits for what should be one task), consider squashing before opening the PR. Use `git rebase -i main` only if necessary — frequent small commits are also fine.

---

## Task 11: Open PR

**Purpose:** The user opens the PR via `pnpm dispatch pr 193` per CLAUDE.local.md. The plan executor does NOT push or open the PR — flag completion and stop.

- [ ] **Step 11.1: Confirm DONE**

Print to the console:

```
DONE — ready for review.

Phase 1a complete: factory scaffolding + entity-name colocation.

Next step (user does): pnpm dispatch pr 193

Unblocks: #194 (Phase 1b — Proposal migration). The first real consumer
of createEntityRouter will pressure-test the L0/L1 surface and surface
any gaps that need spec-field promotion in Phase 1c.
```

---

## Self-review notes (run before handing off)

- **Spec coverage**: All issue-193 acceptance criteria mapped:
  - Factory files exist (Tasks 3–8)
  - Entity-name constants exist (Task 1)
  - abilities.ts derives ENTITY_NAMES + EntityName (Task 2)
  - `pnpm tsc` clean (Tasks 1.5, 2.6, 3.2, 4.2, 5.2, 6.2, 7.3, 8.2, 9.4, 10.1)
  - `pnpm lint` clean (Tasks 1.6, 2.7, 3.3, 4.3, 5.3, 6.3, 7.4, 8.3, 10.2)
  - Discriminated union enforces correct fields per branch (Task 9 probe)
  - `createCrudRouter` refuses NestedEntitySpec at compile time (Task 9 probe)
  - No runtime behavior change (Tasks 10.3, 10.4)
- **Placeholders**: none. Every code step is a complete code block.
- **Type consistency**: `EntityServerSpec`, `CoreEntitySpec`, `NestedEntitySpec`, `AgentCtx`, `CrudHandlers`, `SlotName`, `Row<TTable>`, `Insert<TTable>`, `Update<TTable>` — these names appear identically across Tasks 3–8.
- **Memory pin honored**: no `pnpm build` step anywhere. `pnpm tsc` + `pnpm lint` only.
- **Branch hygiene**: each commit is a single conceptual change. ~7 commits across the plan.
