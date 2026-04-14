# Query Invalidation Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate all 15+ ad-hoc `invalidateQueries` calls across 14 files into a single `useInvalidation()` hook, delete the dead `invalidation.ts` + `query-keys.ts` files, and fix TS errors (router-level `queryFilter()` → `pathFilter()`).

**Architecture:** Single mega-hook in `src/shared/dal/client/use-invalidation.ts`. Router-level `pathFilter()` for own-entity (self-healing), procedure-level `queryFilter()` for cross-entity (precise). Every component that mutates data imports `useInvalidation()` instead of manually calling `queryClient.invalidateQueries()`.

**Tech Stack:** tRPC v11, TanStack React Query, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-13-query-invalidation-consolidation-design.md`

---

### Task 1: Fix and finalize `use-invalidation.ts`

**Files:**
- Modify: `src/shared/dal/client/use-invalidation.ts`

The current file has TS errors: `queryFilter()` on routers must be `pathFilter()`. Also needs `invalidateAgentSettings()` added.

- [ ] **Step 1: Rewrite use-invalidation.ts**

Replace the entire file with the corrected version:

```typescript
'use client'

import { useQueryClient } from '@tanstack/react-query'

import { useTRPC } from '@/trpc/helpers'

/**
 * Type-safe, centralized query invalidation.
 *
 * Two-tier design:
 *  - OWN ENTITY:   router-level pathFilter() → self-healing, new queries auto-covered
 *  - CROSS-ENTITY: procedure-level queryFilter() → precise, opt-in
 *  - DASHBOARD:    always router-level (any entity change refreshes all dashboard queries)
 *
 * If a router/procedure is renamed or restructured, TypeScript errors here — not
 * a silent runtime failure.
 */
export function useInvalidation() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  // ── Cross-Entity Targets ───────────────────────────────────────
  // Procedure-level targets for precise cross-entity invalidation.
  // Type-safe: if a procedure is renamed/moved, TS errors here.
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
  // Own entity: router-level pathFilter() (self-healing — new queries auto-covered)
  // Cross-entity: procedure-level queryFilter() (precise, opt-in)
  // Dashboard: always router-level (any entity change refreshes all dashboard queries)

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

- [ ] **Step 2: Verify no TS errors**

Run: `pnpm tsc --noEmit 2>&1 | grep use-invalidation`
Expected: no errors from this file

- [ ] **Step 3: Commit**

```bash
git add src/shared/dal/client/use-invalidation.ts
git commit -m "fix(invalidation): use pathFilter() for routers, add invalidateAgentSettings"
```

---

### Task 2: Migrate contract-status-panel (3 files)

**Files:**
- Modify: `src/shared/components/contract-status-panel/ui/agent-contract-view.tsx`
- Modify: `src/shared/components/contract-status-panel/ui/homeowner-contract-view.tsx`
- Modify: `src/shared/components/contract-status-panel/ui/customer-age-form.tsx`

All three currently do inline `queryClient.invalidateQueries(...)` targeting `proposalsRouter.contracts.*`. The hook's `invalidateProposal()` covers this via router-level `proposalsRouter.pathFilter()`.

- [ ] **Step 1: Migrate agent-contract-view.tsx**

Replace the import of `useQueryClient` with `useInvalidation`. Remove `useTRPC` if it becomes unused after this change (check if `trpc` is used elsewhere in the file — it is, for mutation options).

In the imports, add:
```typescript
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
```

Remove `useQueryClient` from the `@tanstack/react-query` import (keep `useMutation`).

Replace the `invalidate` function (lines 78-82):
```typescript
// BEFORE:
const invalidate = () => {
  queryClient.invalidateQueries({
    queryKey: trpc.proposalsRouter.contracts.getContractStatus.queryKey({ proposalId }),
  })
}

// AFTER:
const { invalidateProposal } = useInvalidation()
const invalidate = () => invalidateProposal()
```

Remove the `const queryClient = useQueryClient()` line.

- [ ] **Step 2: Migrate homeowner-contract-view.tsx**

In the imports, add:
```typescript
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
```

Remove `useQueryClient` from the `@tanstack/react-query` import (keep `useMutation`).

Replace the `onSuccess` callback (lines 30-33):
```typescript
// BEFORE:
onSuccess: () => {
  startCooldown()
  queryClient.invalidateQueries({
    queryKey: trpc.proposalsRouter.contracts.getContractStatus.queryKey({ proposalId }),
  })
},

// AFTER:
onSuccess: () => {
  startCooldown()
  invalidateProposal()
},
```

Add `const { invalidateProposal } = useInvalidation()` in the component body. Remove `const queryClient = useQueryClient()`. Remove `useTRPC` import and `const trpc = useTRPC()` if `trpc` is no longer used elsewhere in the file (check — it IS used for `trpc.proposalsRouter.contracts.sendContractForSigning.mutationOptions`, so keep it).

- [ ] **Step 3: Migrate customer-age-form.tsx**

In the imports, add:
```typescript
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
```

Remove `useQueryClient` from the `@tanstack/react-query` import (keep `useMutation`).

Replace `onSuccess` (lines 24-27):
```typescript
// BEFORE:
onSuccess: () => {
  queryClient.invalidateQueries({
    queryKey: trpc.proposalsRouter.crud.getProposal.queryKey({ proposalId }),
  })
  toast.success('Age saved')
},

// AFTER:
onSuccess: () => {
  invalidateProposal()
  toast.success('Age saved')
},
```

Add `const { invalidateProposal } = useInvalidation()` in the component body. Remove `const queryClient = useQueryClient()`. Check if `trpc` is still used — it is for `trpc.proposalsRouter.contracts.submitCustomerAge.mutationOptions`, so keep `useTRPC`.

- [ ] **Step 4: Verify no TS errors**

Run: `pnpm tsc --noEmit 2>&1 | grep -E "agent-contract-view|homeowner-contract-view|customer-age-form"`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/shared/components/contract-status-panel/ui/agent-contract-view.tsx \
        src/shared/components/contract-status-panel/ui/homeowner-contract-view.tsx \
        src/shared/components/contract-status-panel/ui/customer-age-form.tsx
git commit -m "refactor(contract-panel): use centralized useInvalidation hook"
```

---

### Task 3: Migrate meetings feature (4 files)

**Files:**
- Modify: `src/features/meetings/ui/views/meeting-flow.tsx`
- Modify: `src/features/meetings/ui/components/edit-contact-form.tsx`
- Modify: `src/features/meetings/ui/components/meeting-owner-select.tsx`
- Modify: `src/features/meetings/hooks/use-meeting-sync.ts`

All four currently do inline invalidation of specific meeting procedures. The hook's `invalidateMeeting()` covers all meeting queries via `meetingsRouter.pathFilter()` plus cross-entity edges.

- [ ] **Step 1: Migrate meeting-flow.tsx**

In the imports, add:
```typescript
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
```

Remove `useQueryClient` from the `@tanstack/react-query` import (keep `useMutation`, `useQuery`).

Replace the `invalidateMeetingQueries` callback (lines 63-70):
```typescript
// BEFORE:
const invalidateMeetingQueries = useCallback(() => {
  void queryClient.invalidateQueries({
    queryKey: trpc.meetingsRouter.getById.queryKey({ id: meetingId }),
  })
  void queryClient.invalidateQueries({
    queryKey: trpc.meetingsRouter.getPersonaProfile.queryKey({ meetingId }),
  })
}, [meetingId, queryClient, trpc])

// AFTER:
const { invalidateMeeting } = useInvalidation()
const invalidateMeetingQueries = useCallback(() => {
  invalidateMeeting()
}, [invalidateMeeting])
```

Remove `const queryClient = useQueryClient()`. Check if `queryClient` is used elsewhere in the file — if not, remove the import too.

- [ ] **Step 2: Migrate edit-contact-form.tsx**

In the imports, add:
```typescript
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
```

Remove `useQueryClient` from the `@tanstack/react-query` import (keep `useMutation`).

Replace `onSuccess` (lines 29-32):
```typescript
// BEFORE:
onSuccess: () => {
  void queryClient.invalidateQueries(trpc.meetingsRouter.getAll.queryFilter())
  toast.success('Meeting updated')
  router.push(ROOTS.dashboard.meetings.root())
},

// AFTER:
onSuccess: () => {
  invalidateMeeting()
  toast.success('Meeting updated')
  router.push(ROOTS.dashboard.meetings.root())
},
```

Add `const { invalidateMeeting } = useInvalidation()` in the component body. Remove `const queryClient = useQueryClient()`.

- [ ] **Step 3: Migrate meeting-owner-select.tsx**

In the imports, add:
```typescript
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
```

Remove `useQueryClient` from the `@tanstack/react-query` import (keep `useMutation`, `useQuery`).

Replace `onSuccess` (lines 40-43):
```typescript
// BEFORE:
onSuccess: () => {
  toast.success('Owner assigned')
  void queryClient.invalidateQueries({
    queryKey: trpc.meetingsRouter.getById.queryKey({ id: meetingId }),
  })
},

// AFTER:
onSuccess: () => {
  toast.success('Owner assigned')
  invalidateMeeting()
},
```

Add `const { invalidateMeeting } = useInvalidation()` in the component body. Remove `const queryClient = useQueryClient()`.

- [ ] **Step 4: Migrate use-meeting-sync.ts**

In the imports, add:
```typescript
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
```

Remove `useQueryClient` from the `@tanstack/react-query` import. Remove `useTRPC` import if `trpc` is no longer used (check — it may be used for channel name or other queries).

Replace the `invalidate` callback (lines 21-28):
```typescript
// BEFORE:
const invalidate = useCallback(() => {
  void queryClient.invalidateQueries({
    queryKey: trpc.meetingsRouter.getById.queryKey({ id: meetingId }),
  })
  void queryClient.invalidateQueries({
    queryKey: trpc.meetingsRouter.getPersonaProfile.queryKey({ meetingId }),
  })
}, [meetingId, queryClient, trpc])

// AFTER:
const { invalidateMeeting } = useInvalidation()
const invalidate = useCallback(() => {
  invalidateMeeting()
}, [invalidateMeeting])
```

Remove `const queryClient = useQueryClient()` and `const trpc = useTRPC()` if neither is used elsewhere.

- [ ] **Step 5: Verify no TS errors**

Run: `pnpm tsc --noEmit 2>&1 | grep -E "meeting-flow|edit-contact-form|meeting-owner-select|use-meeting-sync"`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/features/meetings/ui/views/meeting-flow.tsx \
        src/features/meetings/ui/components/edit-contact-form.tsx \
        src/features/meetings/ui/components/meeting-owner-select.tsx \
        src/features/meetings/hooks/use-meeting-sync.ts
git commit -m "refactor(meetings): use centralized useInvalidation hook"
```

---

### Task 4: Migrate customer-pipelines feature (2 files)

**Files:**
- Modify: `src/features/customer-pipelines/ui/components/customer-profile-modal.tsx`
- Modify: `src/features/customer-pipelines/ui/components/quick-note-input.tsx`

Both currently invalidate `customerPipelinesRouter.getCustomerProfile.queryFilter()` inline.

- [ ] **Step 1: Migrate customer-profile-modal.tsx**

In the imports, add:
```typescript
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
```

Remove `useQueryClient` from the `@tanstack/react-query` import (keep `useQuery`).

Replace the handler (lines 26-30):
```typescript
// BEFORE:
function handleMutationSuccess() {
  void queryClient.invalidateQueries(
    trpc.customerPipelinesRouter.getCustomerProfile.queryFilter(),
  )
}

// AFTER:
const { invalidateCustomer } = useInvalidation()
function handleMutationSuccess() {
  invalidateCustomer()
}
```

Remove `const queryClient = useQueryClient()`. Check if `trpc` is still used — it is for `trpc.customerPipelinesRouter.getCustomerProfile.queryOptions(...)`, so keep `useTRPC`.

- [ ] **Step 2: Migrate quick-note-input.tsx**

In the imports, add:
```typescript
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
```

Remove `useQueryClient` from the `@tanstack/react-query` import (keep `useMutation`).

Replace `onSuccess` (lines 22-26):
```typescript
// BEFORE:
onSuccess: () => {
  setContent('')
  void queryClient.invalidateQueries(trpc.customerPipelinesRouter.getCustomerProfile.queryFilter())
  onSuccess()
},

// AFTER:
onSuccess: () => {
  setContent('')
  invalidateCustomer()
  onSuccess()
},
```

Add `const { invalidateCustomer } = useInvalidation()` in the component body. Remove `const queryClient = useQueryClient()`. Check if `trpc` is still used — it is for the mutation options, so keep it.

- [ ] **Step 3: Verify no TS errors**

Run: `pnpm tsc --noEmit 2>&1 | grep -E "customer-profile-modal|quick-note-input"`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/features/customer-pipelines/ui/components/customer-profile-modal.tsx \
        src/features/customer-pipelines/ui/components/quick-note-input.tsx
git commit -m "refactor(customer-pipelines): use centralized useInvalidation hook"
```

---

### Task 5: Migrate agent-settings feature (3 files)

**Files:**
- Modify: `src/features/agent-settings/ui/components/identity-contact-section.tsx`
- Modify: `src/features/agent-settings/ui/components/customer-brand-section.tsx`
- Modify: `src/features/agent-settings/ui/components/headshot-upload.tsx`

All three invalidate `trpc.agentSettingsRouter.getProfile.queryKey()` inline.

- [ ] **Step 1: Migrate identity-contact-section.tsx**

In the imports, add:
```typescript
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
```

Remove `useQueryClient` from the `@tanstack/react-query` import (keep `useMutation`).

Replace `onSuccess` (lines 39-40):
```typescript
// BEFORE:
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: trpc.agentSettingsRouter.getProfile.queryKey() })
  toast.success('Profile updated')
},

// AFTER:
onSuccess: () => {
  invalidateAgentSettings()
  toast.success('Profile updated')
},
```

Add `const { invalidateAgentSettings } = useInvalidation()` in the component body. Remove `const queryClient = useQueryClient()`.

- [ ] **Step 2: Migrate customer-brand-section.tsx**

Same pattern. In the imports, add:
```typescript
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
```

Remove `useQueryClient` from the `@tanstack/react-query` import (keep `useMutation`).

Replace `onSuccess` (lines 45-46):
```typescript
// BEFORE:
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: trpc.agentSettingsRouter.getProfile.queryKey() })
  toast.success('Brand profile updated')
},

// AFTER:
onSuccess: () => {
  invalidateAgentSettings()
  toast.success('Brand profile updated')
},
```

Add `const { invalidateAgentSettings } = useInvalidation()` in the component body. Remove `const queryClient = useQueryClient()`.

- [ ] **Step 3: Migrate headshot-upload.tsx**

In the imports, add:
```typescript
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
```

Remove `useQueryClient` from the `@tanstack/react-query` import (keep `useMutation`).

Replace line 62:
```typescript
// BEFORE:
queryClient.invalidateQueries({ queryKey: trpc.agentSettingsRouter.getProfile.queryKey() })

// AFTER:
invalidateAgentSettings()
```

Add `const { invalidateAgentSettings } = useInvalidation()` in the component body. Remove `const queryClient = useQueryClient()`.

- [ ] **Step 4: Verify no TS errors**

Run: `pnpm tsc --noEmit 2>&1 | grep -E "identity-contact|customer-brand|headshot-upload"`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/features/agent-settings/ui/components/identity-contact-section.tsx \
        src/features/agent-settings/ui/components/customer-brand-section.tsx \
        src/features/agent-settings/ui/components/headshot-upload.tsx
git commit -m "refactor(agent-settings): use centralized useInvalidation hook"
```

---

### Task 6: Migrate sortable-media-manager (optimistic update pattern)

**Files:**
- Modify: `src/shared/components/portfolio/sortable-media-manager.tsx`

This file uses the optimistic update pattern (`onMutate`/`onError`/`onSettled`). It still needs `useQueryClient()` for `cancelQueries`, `getQueryData`, and `setQueryData`. Only the `onSettled` invalidation switches to the hook.

- [ ] **Step 1: Add useInvalidation import and usage**

In the imports, add:
```typescript
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
```

Keep `useQueryClient` in the `@tanstack/react-query` import (still needed for optimistic update cache manipulation).

Add `const { invalidateProject } = useInvalidation()` in the component body.

Replace `onSettled` (line 125):
```typescript
// BEFORE:
onSettled: () => {
  queryClient.invalidateQueries(editQueryOptions)
},

// AFTER:
onSettled: () => {
  invalidateProject()
},
```

- [ ] **Step 2: Verify no TS errors**

Run: `pnpm tsc --noEmit 2>&1 | grep sortable-media-manager`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/shared/components/portfolio/sortable-media-manager.tsx
git commit -m "refactor(portfolio): use centralized useInvalidation in onSettled"
```

---

### Task 7: Migrate pipeline-change hook

**Files:**
- Modify: `src/shared/pipelines/hooks/use-pipeline-change.ts`

Currently imports `QUERY_KEYS` from the dead `query-keys.ts` file. Switch to `useInvalidation`.

- [ ] **Step 1: Rewrite use-pipeline-change.ts**

Replace the imports and body:

```typescript
// BEFORE imports:
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/shared/dal/client/query-keys'

// AFTER imports:
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
```

Replace the callback body (lines 21-27):
```typescript
// BEFORE:
return useCallback((next: Pipeline) => {
  onPipelineChange(next, {
    navigate: p => router.push(ROOTS.dashboard.pipeline(p)),
    invalidateQueries: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customers.pipeline })
    },
  })
}, [router, queryClient])

// AFTER:
const { invalidateCustomer } = useInvalidation()
return useCallback((next: Pipeline) => {
  onPipelineChange(next, {
    navigate: p => router.push(ROOTS.dashboard.pipeline(p)),
    invalidateQueries: () => invalidateCustomer(),
  })
}, [router, invalidateCustomer])
```

Remove `const queryClient = useQueryClient()` and the `useQueryClient` import.

- [ ] **Step 2: Verify no TS errors**

Run: `pnpm tsc --noEmit 2>&1 | grep use-pipeline-change`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/shared/pipelines/hooks/use-pipeline-change.ts
git commit -m "refactor(pipelines): use centralized useInvalidation hook"
```

---

### Task 8: Delete dead files and verify

**Files:**
- Delete: `src/shared/dal/client/invalidation.ts`
- Delete: `src/shared/dal/client/query-keys.ts`

- [ ] **Step 1: Check for remaining imports of dead files**

Run: `grep -r "from.*dal/client/query-keys" src/` and `grep -r "from.*dal/client/invalidation" src/`
Expected: only `use-pipeline-change.ts` (already migrated in Task 7) or zero results.

If any file still imports these, migrate it first before deleting.

- [ ] **Step 2: Delete the files**

```bash
rm src/shared/dal/client/invalidation.ts src/shared/dal/client/query-keys.ts
```

- [ ] **Step 3: Run full type check**

Run: `pnpm tsc --noEmit`
Expected: no errors related to missing `invalidation.ts` or `query-keys.ts`

- [ ] **Step 4: Run lint**

Run: `pnpm lint`
Expected: no new lint errors

- [ ] **Step 5: Commit**

```bash
git add -u src/shared/dal/client/invalidation.ts src/shared/dal/client/query-keys.ts
git commit -m "chore: delete dead invalidation.ts and query-keys.ts"
```

---

### Task 9: Final audit — no remaining ad-hoc invalidation

- [ ] **Step 1: Search for any remaining ad-hoc invalidateQueries calls**

Run: `grep -rn "invalidateQueries" src/ --include="*.ts" --include="*.tsx" | grep -v use-invalidation.ts | grep -v node_modules`
Expected: only `sortable-media-manager.tsx` (optimistic update cache ops: `cancelQueries` line — not an invalidation call) should remain. Zero other `invalidateQueries` calls.

If any remain, migrate them using the same pattern (import `useInvalidation`, destructure the relevant function, replace the inline call).

- [ ] **Step 2: Verify full build passes**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: clean pass on both

- [ ] **Step 3: Final commit (if any stragglers were fixed)**

```bash
git add -A
git commit -m "refactor: complete query invalidation consolidation"
```
