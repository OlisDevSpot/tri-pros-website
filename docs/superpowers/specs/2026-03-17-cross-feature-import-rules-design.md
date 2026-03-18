# Cross-Feature Import Rules Design

## Problem

Features import from other features by reaching into internal files (`@/features/X/ui/components/specific-file`). This creates tight coupling, makes refactoring risky, and one circular dependency already exists (agent-dashboard <-> pipeline).

## Design

### The Rule

A feature may import from another feature **only if**:
1. The dependency is genuinely one-way (no cycles)
2. It goes through that feature's **public entrypoint**
3. It does not reach into the other feature's internals
4. The import is documented in the entrypoint barrel

### Public Entrypoints

Each feature that exports to other features creates **granular category-level barrel files**:

```
src/features/[feature]/
├── ui/
│   └── views/
│       └── index.ts    # Public view entrypoint
├── types/
│   └── index.ts        # Already exists — types are public
```

- `ui/views/index.ts` re-exports ONLY the views other features consume
- Internal feature code continues to import directly from specific files (no change)
- Cross-feature consumers MUST import from the entrypoint: `@/features/meetings/ui/views` not `@/features/meetings/ui/views/create-meeting-view`
- No barrel files are added to `ui/components/`, `constants/`, `hooks/`, `lib/`, or `dal/` — those remain internal

### Shared Components for Cross-Feature UI

When a UI component is consumed by 3+ features, it belongs in `shared/components/`. When consumed by exactly 2 features with a clear owner, it can stay in the owning feature and be exported through an entrypoint.

### Current Violations and Fixes

**19 cross-feature imports** exist today, grouped into 5 categories:

#### 1. Dashboard hub importing views (9 imports) — use view entrypoints
- Create `features/meetings/ui/views/index.ts` — exports 3 views
- Create `features/proposal-flow/ui/views/index.ts` — exports 3 views
- Create `features/showroom/ui/views/index.ts` — exports 3 views
- Update `dashboard-hub.tsx` to import from `@/features/X/ui/views`

#### 2. CustomerProfileModal (3 imports) — move to shared
Used by pipeline, meetings, and proposal-flow. Move to `shared/components/customer-profile-modal.tsx`.

#### 3. PipelineViewToggle (2 imports, creates cycle) — generalize + move to shared
Rename to `DataViewTypeToggle` with generic `DataViewType` union (`'kanban' | 'table'`, extensible to `'calendar' | 'list'`). Move to `shared/components/data-view-type-toggle.tsx`. This breaks the agent-dashboard <-> pipeline cycle and creates a reusable component for any data display area.

#### 4. dashboardStepParser (3 imports) — move to shared
URL parsing utility used by showroom views. Move to `shared/lib/url-parsers.ts`.

#### 5. companyInfo (1 import) — fix stale path
Update `proposal-flow/ui/components/proposal/heading.tsx` to import from `@/shared/constants/company` directly instead of the re-export stub at `@/features/landing/data/company`.

### After Refactoring

The only remaining cross-feature imports go through `ui/views/index.ts` entrypoints — the explicit, one-way dashboard orchestrator pattern. All component/lib/constant sharing uses `shared/`.

### Convention Updates

**New rule** (added to coding conventions):
> `ui/views/index.ts` is the ONLY allowed barrel file for cross-feature view consumption. It exports only the views that other features need. Internal feature consumers continue to import directly from view files.

**Updated import directionality rule:**
```
src/shared/           -> shared/ ONLY, never features/
src/features/         -> shared/, same feature, or other features/ THROUGH public entrypoints only
src/trpc/routers/     -> features/ (DAL, schemas) and shared/ (glue layer)
src/app/              -> features/ and shared/
```
