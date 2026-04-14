# Query Invalidation Consolidation

**Date:** 2026-04-13
**Status:** Approved
**Scope:** Replace all ad-hoc `invalidateQueries` calls with a single `useInvalidation()` hook

## Problem

Three invalidation approaches coexist:

1. **`use-invalidation.ts`** — tRPC-based hook with router/procedure `queryFilter()`. Well-designed but has TS errors (`queryFilter()` used on routers instead of `pathFilter()`) and **zero consumers**.
2. **`invalidation.ts` + `query-keys.ts`** — manual query key arrays. Also **zero consumers**.
3. **30+ ad-hoc `invalidateQueries` calls** scattered across 18 files — the actual invalidation in production.

This means:
- No single source of truth for what a mutation invalidates
- Cross-entity edges are duplicated/inconsistent across call sites
- Adding a new query requires hunting for all mutation sites that should invalidate it

## Decision

**Single mega-hook in one file.** We evaluated a composable factory pattern (domain files composed by a base hook) but concluded it's premature decomposition for ~7 entities / ~105 lines. One file is more readable, more traceable for cross-entity edges, and trivially refactorable if we outgrow it.

## Design

### The Hook: `src/shared/dal/client/use-invalidation.ts`

```typescript
'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/helpers'

export function useInvalidation() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  // ── Cross-Entity Targets ───────────────────────────────────────
  // Procedure-level targets for precise cross-entity invalidation.
  const cross = {
    customerPipeline: () =>
      trpc.customerPipelinesRouter.getCustomerPipelineItems.queryFilter(),
    customerProfile: (customerId?: string) =>
      customerId
        ? trpc.customerPipelinesRouter.getCustomerProfile.queryFilter({ customerId })
        : trpc.customerPipelinesRouter.getCustomerProfile.queryFilter(),
    meetingCustomerProjects: () =>
      trpc.meetingsRouter.getCustomerProjects.queryFilter(),
    landingProjects: () =>
      trpc.landingRouter.projectsRouter.getProjects.queryFilter(),
  }

  // ── Entity Invalidators ────────────────────────────────────────
  // Own entity: router-level pathFilter() (self-healing)
  // Cross-entity: procedure-level queryFilter() (precise)
  // Dashboard: always router-level (any entity change refreshes stats)

  function invalidateCustomer(customerId?: string) {
    void qc.invalidateQueries(trpc.customerPipelinesRouter.pathFilter())
    void qc.invalidateQueries(trpc.dashboardRouter.pathFilter())
  }

  function invalidateMeeting(opts?: { meetingId?: string; customerId?: string }) {
    void qc.invalidateQueries(trpc.meetingsRouter.pathFilter())
    void qc.invalidateQueries(cross.customerPipeline())
    void qc.invalidateQueries(cross.customerProfile(opts?.customerId))
    void qc.invalidateQueries(trpc.dashboardRouter.pathFilter())
  }

  function invalidateProposal(opts?: { proposalId?: string; customerId?: string }) {
    void qc.invalidateQueries(trpc.proposalsRouter.pathFilter())
    void qc.invalidateQueries(cross.customerPipeline())
    void qc.invalidateQueries(cross.customerProfile(opts?.customerId))
    void qc.invalidateQueries(trpc.dashboardRouter.pathFilter())
  }

  function invalidateProject(opts?: { projectId?: string; customerId?: string }) {
    void qc.invalidateQueries(trpc.projectsRouter.pathFilter())
    void qc.invalidateQueries(cross.customerPipeline())
    void qc.invalidateQueries(cross.customerProfile(opts?.customerId))
    void qc.invalidateQueries(cross.meetingCustomerProjects())
    void qc.invalidateQueries(cross.landingProjects())
    void qc.invalidateQueries(trpc.dashboardRouter.pathFilter())
  }

  function invalidateAgentSettings() {
    void qc.invalidateQueries(trpc.agentSettingsRouter.pathFilter())
  }

  return {
    invalidateCustomer,
    invalidateMeeting,
    invalidateProposal,
    invalidateProject,
    invalidateAgentSettings,
  }
}
```

### API Rules

1. **Router-level** (`pathFilter()`) for own-entity invalidation — self-healing, new queries auto-covered
2. **Procedure-level** (`queryFilter()`) for cross-entity targets — precise, opt-in
3. **Dashboard** always router-level — any entity change refreshes all dashboard queries
4. Type-safe: if a router/procedure is renamed, TypeScript errors in this one file

### Migration: Ad-Hoc Call Sites to Replace

Each call site switches from inline `queryClient.invalidateQueries(...)` to destructured hook functions.

#### Contract Status Panel (3 files)
- `contract-status-panel/ui/agent-contract-view.tsx` — `invalidateProposal()` (contracts live under proposalsRouter)
- `contract-status-panel/ui/homeowner-contract-view.tsx` — `invalidateProposal()`
- `contract-status-panel/ui/customer-age-form.tsx` — `invalidateProposal()`

#### Meetings (4 files)
- `features/meetings/ui/views/meeting-flow.tsx` — `invalidateMeeting()`
- `features/meetings/ui/components/edit-contact-form.tsx` — `invalidateMeeting()`
- `features/meetings/ui/components/meeting-owner-select.tsx` — `invalidateMeeting()`
- `features/meetings/hooks/use-meeting-sync.ts` — `invalidateMeeting()`

#### Customer Pipelines (2 files)
- `features/customer-pipelines/ui/components/customer-profile-modal.tsx` — `invalidateCustomer()`
- `features/customer-pipelines/ui/components/quick-note-input.tsx` — `invalidateCustomer()`

#### Agent Settings (3 files)
- `features/agent-settings/ui/components/identity-contact-section.tsx` — `invalidateAgentSettings()`
- `features/agent-settings/ui/components/customer-brand-section.tsx` — `invalidateAgentSettings()`
- `features/agent-settings/ui/components/headshot-upload.tsx` — `invalidateAgentSettings()`

#### Portfolio (1 file)
- `shared/components/portfolio/sortable-media-manager.tsx` — keep optimistic update pattern, use `invalidateProject()` in `onSettled`

#### Pipeline Change (1 file)
- `shared/pipelines/hooks/use-pipeline-change.ts` — `invalidateCustomer()`

### Files to Delete

- `src/shared/dal/client/invalidation.ts` — replaced by `use-invalidation.ts`
- `src/shared/dal/client/query-keys.ts` — manual keys no longer needed; tRPC `pathFilter()`/`queryFilter()` is the source of truth

### Exception: Optimistic Updates

Components using the `onMutate`/`onError`/`onSettled` optimistic update pattern (e.g., `sortable-media-manager.tsx`) still need direct `queryClient` access for `cancelQueries`, `getQueryData`, and `setQueryData`. These components use `useInvalidation()` for the `onSettled` refetch but keep `useQueryClient()` for cache manipulation.

## Future Scalability

- **New entity:** Add one function to `use-invalidation.ts`, add cross-entity targets where needed
- **New cross-entity edge:** Add one `void qc.invalidateQueries(cross.newTarget())` line to the relevant function
- **Outgrow one file (15+ entities, 300+ lines):** Decompose into domain files with factory pattern — 30-minute refactor
