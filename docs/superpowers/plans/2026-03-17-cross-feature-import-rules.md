# Cross-Feature Import Rules Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Enforce cross-feature import rules: public entrypoints only, no internal reaching, no cycles. Move shared concerns to `shared/`.

**Tech Stack:** Next.js 15, TypeScript, React

---

## Task 1: Move Shared Concerns to `shared/`

**Why:** 3 components and 1 utility are used across 3+ features. They belong in shared.

**Files:**
- Move: `src/features/agent-dashboard/ui/components/pipeline-view-toggle.tsx` -> `src/shared/components/data-view-type-toggle.tsx` (rename + generalize)
- Move: `src/features/pipeline/ui/components/customer-profile-modal.tsx` -> `src/shared/components/customer-profile-modal.tsx`
- Move: `src/features/agent-dashboard/lib/url-parsers.ts` -> `src/shared/lib/url-parsers.ts`
- Fix: `src/features/proposal-flow/ui/components/proposal/heading.tsx` import of companyInfo

### Steps

- [ ] **Step 1: Generalize PipelineViewToggle -> DataViewTypeToggle**

Read `src/features/agent-dashboard/ui/components/pipeline-view-toggle.tsx`. Create `src/shared/components/data-view-type-toggle.tsx` with:
- Rename `PipelineLayout` -> `DataViewType = 'kanban' | 'table'`
- Rename `PipelineViewToggle` -> `DataViewTypeToggle`
- Same UI logic, updated names

- [ ] **Step 2: Move CustomerProfileModal to shared**

```bash
git mv src/features/pipeline/ui/components/customer-profile-modal.tsx src/shared/components/customer-profile-modal.tsx
```

Update its internal imports if needed (it may import from pipeline types/dal — those would need to use the feature's public API or shared entities).

- [ ] **Step 3: Move url-parsers to shared**

```bash
git mv src/features/agent-dashboard/lib/url-parsers.ts src/shared/lib/url-parsers.ts
```

- [ ] **Step 4: Update ALL consumers of moved files**

Search and replace all import paths:
- `@/features/agent-dashboard/ui/components/pipeline-view-toggle` -> `@/shared/components/data-view-type-toggle` (also rename the imported symbols)
- `@/features/pipeline/ui/components/customer-profile-modal` -> `@/shared/components/customer-profile-modal`
- `@/features/agent-dashboard/lib/url-parsers` -> `@/shared/lib/url-parsers`

- [ ] **Step 5: Fix companyInfo import in proposal-flow**

In `src/features/proposal-flow/ui/components/proposal/heading.tsx`, change:
`from '@/features/landing/data/company'` -> `from '@/shared/constants/company'`

- [ ] **Step 6: Delete old files (if git mv left stubs)**

Remove `src/features/agent-dashboard/ui/components/pipeline-view-toggle.tsx` and any other stale files.

- [ ] **Step 7: Run typecheck and commit**

Run: `pnpm tsc --noEmit`

```
git commit -m "refactor: move shared concerns (DataViewTypeToggle, CustomerProfileModal, url-parsers) to shared/"
```

---

## Task 2: Create Feature View Entrypoints

**Why:** Dashboard hub imports 9 view components from 3 features. These should go through public entrypoints, not reach into internals.

**Files:**
- Create: `src/features/meetings/ui/views/index.ts`
- Create: `src/features/proposal-flow/ui/views/index.ts`
- Create: `src/features/showroom/ui/views/index.ts`
- Modify: `src/features/agent-dashboard/ui/views/dashboard-hub.tsx`

- [ ] **Step 1: Create meetings view entrypoint**

Create `src/features/meetings/ui/views/index.ts`:
```typescript
export { CreateMeetingView } from './create-meeting-view'
export { EditMeetingSetupView } from './edit-meeting-setup-view'
export { PastMeetingsView } from './past-meetings-view'
```

- [ ] **Step 2: Create proposal-flow view entrypoint**

Create `src/features/proposal-flow/ui/views/index.ts`:
```typescript
export { CreateNewProposalView } from './create-new-proposal-view'
export { EditProposalView } from './edit-proposal-view'
export { PastProposalsView } from './past-proposals-view'
```

- [ ] **Step 3: Create showroom view entrypoint**

Create `src/features/showroom/ui/views/index.ts`:
```typescript
export { CreateProjectView } from './create-project-view'
export { EditProjectView } from './edit-project-view'
export { PortfolioProjectsView } from './portfolio-projects-view'
```

- [ ] **Step 4: Update dashboard-hub.tsx to use entrypoints**

Replace individual file imports with entrypoint imports:
```typescript
import { CreateMeetingView, EditMeetingSetupView, PastMeetingsView } from '@/features/meetings/ui/views'
import { CreateNewProposalView, EditProposalView, PastProposalsView } from '@/features/proposal-flow/ui/views'
import { CreateProjectView, EditProjectView, PortfolioProjectsView } from '@/features/showroom/ui/views'
```

- [ ] **Step 5: Verify no remaining internal cross-feature imports**

```bash
grep -rn "from '@/features/" src/features/ | grep -v "/types" | grep -v "ui/views'" | grep -v 'ui/views"'
```

Expected: Zero matches (all cross-feature imports go through entrypoints or shared).

- [ ] **Step 6: Run typecheck and commit**

Run: `pnpm tsc --noEmit`

```
git commit -m "refactor: add feature view entrypoints, route cross-feature imports through public API"
```

---

## Task 3: Update Conventions and Verify

- [ ] **Step 1: Update coding conventions memory**

Update Rule 10 (barrel files) and Rule 12 (import directionality) in `memory/coding-conventions.md`.

- [ ] **Step 2: Run lint**

Run: `pnpm lint`

- [ ] **Step 3: Final cross-feature audit**

```bash
grep -rn "from '@/features/" src/features/ | grep -v "/types" | grep -v "ui/views'"
```

Zero non-type, non-entrypoint cross-feature imports.
