# Codebase Quality Remediation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all import directionality violations, type derivation violations, feature architecture violations, introduce feature-level DAL, and merge `portfolio/` into `showroom/` as a single unified feature.

**Architecture:** The codebase follows strict feature-based architecture. Each feature owns its own DAL (`dal/server/`, `dal/client/`) for single-feature data access; cross-feature DAL stays in `shared/dal/`. Import rules: `shared/` never imports from `features/`; `trpc/` can import from `features/` (glue layer); `features/` can import from `shared/` and other `features/`. Types derive from source-of-truth schemas (entity Zod > Drizzle > tRPC inferred > custom).

**Tech Stack:** Next.js 15, TypeScript, Drizzle ORM, tRPC, Zod, React, Tailwind v4, shadcn/ui

---

## Task 1: Move DAL to Features (Foundational)

**Why:** DAL functions that serve a single feature currently live in `shared/dal/`, forcing `shared/` to import from `features/` for types/constants. Moving these to feature-level `dal/` directories eliminates all those import violations at the source.

**Migration map:**

| Current Location | New Location | Reason |
|---|---|---|
| `shared/dal/server/dashboard/` (4 files) | `features/agent-dashboard/dal/server/` | Only `dashboardRouter` consumes |
| `shared/dal/server/pipeline/` (3 files) | `features/pipeline/dal/server/` | Only `pipelineRouter` consumes |
| `shared/dal/server/showroom/` (4 files) | `features/showroom/dal/server/` | Only `showroomRouter` consumes |
| `shared/dal/server/landing/` (1 file) | `features/landing/dal/server/` | Only `landingRouter` + SSG pages consume |
| `shared/dal/client/proposals/` (5 files) | `features/proposal-flow/dal/client/` | Only proposal-flow UI consumes |
| `shared/dal/client/finance-options/` (1 file) | `features/proposal-flow/dal/client/` | Only proposal-flow UI consumes |

**Stays in `shared/dal/`:**

| Location | Why |
|---|---|
| `shared/dal/server/customers/api.ts` | Used by meetings, pipeline, sync jobs, multiple routers |
| `shared/dal/server/proposals/api.ts` | Used by proposal-flow, docusign router, API routes |
| `shared/dal/server/proposals/proposal-views.ts` | Used by proposal router (shared concern) |
| `shared/dal/server/finance-options/api.ts` | Used by proposal router (stays alongside proposals) |

**Files:**
- Move: 6 server DAL directories (18 files total)
- Move: 2 client DAL directories (6 files total)
- Modify: `src/trpc/routers/dashboard.router.ts` (update DAL imports)
- Modify: `src/trpc/routers/pipeline.router.ts` (update DAL imports)
- Modify: `src/trpc/routers/showroom.router.ts` (update DAL imports)
- Modify: `src/trpc/routers/landing.router/` (update DAL imports)
- Modify: All proposal-flow UI files that import from `shared/dal/client/proposals/` and `shared/dal/client/finance-options/`
- Modify: `src/app/(frontend)/(site)/portfolio/projects/[projectAccessor]/page.tsx` (imports landing DAL for SSG)

- [ ] **Step 1: Move dashboard DAL to agent-dashboard feature**

```bash
mkdir -p src/features/agent-dashboard/dal/server
git mv src/shared/dal/server/dashboard/get-action-queue.ts src/features/agent-dashboard/dal/server/
git mv src/shared/dal/server/dashboard/get-pipeline-items.ts src/features/agent-dashboard/dal/server/
git mv src/shared/dal/server/dashboard/get-pipeline-stats.ts src/features/agent-dashboard/dal/server/
git mv src/shared/dal/server/dashboard/move-pipeline-item.ts src/features/agent-dashboard/dal/server/
```

Update imports inside moved files: `@/features/agent-dashboard/constants/pipeline-stages` imports are now same-feature — no violation. No changes needed to those imports.

- [ ] **Step 2: Move pipeline DAL to pipeline feature**

```bash
mkdir -p src/features/pipeline/dal/server
git mv src/shared/dal/server/pipeline/get-customer-pipeline-items.ts src/features/pipeline/dal/server/
git mv src/shared/dal/server/pipeline/get-customer-profile.ts src/features/pipeline/dal/server/
git mv src/shared/dal/server/pipeline/move-customer-pipeline-item.ts src/features/pipeline/dal/server/
```

Update imports inside moved files: `@/features/pipeline/types`, `@/features/pipeline/constants/`, `@/features/pipeline/lib/` imports are now same-feature — no violation. No changes needed.

- [ ] **Step 3: Move showroom DAL to showroom feature**

```bash
mkdir -p src/features/showroom/dal/server
git mv src/shared/dal/server/showroom/get-project-for-edit.ts src/features/showroom/dal/server/
git mv src/shared/dal/server/showroom/get-showroom-project-detail.ts src/features/showroom/dal/server/
git mv src/shared/dal/server/showroom/get-showroom-projects.ts src/features/showroom/dal/server/
git mv src/shared/dal/server/showroom/manage-project.ts src/features/showroom/dal/server/
```

- [ ] **Step 4: Move landing DAL to landing feature**

```bash
mkdir -p src/features/landing/dal/server
git mv src/shared/dal/server/landing/projects.ts src/features/landing/dal/server/
```

- [ ] **Step 5: Move client DAL to proposal-flow feature**

```bash
mkdir -p src/features/proposal-flow/dal/client/queries
mkdir -p src/features/proposal-flow/dal/client/mutations
git mv src/shared/dal/client/proposals/queries/use-get-proposal.ts src/features/proposal-flow/dal/client/queries/
git mv src/shared/dal/client/proposals/queries/use-get-proposals.ts src/features/proposal-flow/dal/client/queries/
git mv src/shared/dal/client/proposals/mutations/use-create-proposal.ts src/features/proposal-flow/dal/client/mutations/
git mv src/shared/dal/client/proposals/mutations/use-send-proposal-email.ts src/features/proposal-flow/dal/client/mutations/
git mv src/shared/dal/client/proposals/mutations/use-update-proposal.ts src/features/proposal-flow/dal/client/mutations/
git mv src/shared/dal/client/finance-options/queries/use-get-finance-options.ts src/features/proposal-flow/dal/client/queries/
```

- [ ] **Step 6: Update all tRPC router imports**

Each tRPC router must update its DAL import paths:

- `src/trpc/routers/dashboard.router.ts`: Change `@/shared/dal/server/dashboard/` -> `@/features/agent-dashboard/dal/server/`
- `src/trpc/routers/pipeline.router.ts`: Change `@/shared/dal/server/pipeline/` -> `@/features/pipeline/dal/server/`
- `src/trpc/routers/showroom.router.ts`: Change `@/shared/dal/server/showroom/` -> `@/features/showroom/dal/server/`
- `src/trpc/routers/landing.router/`: Change `@/shared/dal/server/landing/` -> `@/features/landing/dal/server/`

- [ ] **Step 7: Update proposal-flow UI imports**

All proposal-flow files that import from `@/shared/dal/client/proposals/` or `@/shared/dal/client/finance-options/` must be updated to `@/features/proposal-flow/dal/client/`:

Search: `grep -r "from '@/shared/dal/client" src/features/proposal-flow/`

Update each match to the new feature-local path.

- [ ] **Step 8: Update SSG page imports**

`src/app/(frontend)/(site)/portfolio/projects/[projectAccessor]/page.tsx` imports from showroom DAL:
- `from '@/shared/dal/server/showroom/get-showroom-project-detail'` -> `from '@/features/showroom/dal/server/get-showroom-project-detail'`
- `from '@/shared/dal/server/showroom/get-showroom-projects'` -> `from '@/features/showroom/dal/server/get-showroom-projects'`

Also check `src/app/(frontend)/(site)/portfolio/projects/page.tsx` for similar showroom DAL imports.

- [ ] **Step 9: Update ALL remaining type/value imports from old DAL paths**

Feature files (components, views, lib, hooks) that import types from old shared DAL paths must be updated. This includes:

- Agent-dashboard UI files importing `ActionItem` from `@/shared/dal/server/dashboard/get-action-queue`
- Agent-dashboard `lib/group-items-by-stage.ts` importing `MeetingPipelineItem`, `ProposalPipelineItem` from `@/shared/dal/server/dashboard/get-pipeline-items`
- Any other feature files with stale DAL imports

Run comprehensive search:
```bash
grep -r "from '@/shared/dal" src/features/
```

Update ALL matches to their new feature-local paths.

- [ ] **Step 10: Clean up empty shared DAL directories**

```bash
rm -rf src/shared/dal/server/dashboard/
rm -rf src/shared/dal/server/pipeline/
rm -rf src/shared/dal/server/showroom/
rm -rf src/shared/dal/server/landing/
rm -rf src/shared/dal/client/proposals/
rm -rf src/shared/dal/client/finance-options/
rm -rf src/shared/dal/client/customers/  # empty directory
```

- [ ] **Step 11: Verify no remaining stale imports**

```bash
grep -r "shared/dal/server/dashboard\|shared/dal/server/pipeline\|shared/dal/server/showroom\|shared/dal/server/landing\|shared/dal/client/proposals\|shared/dal/client/finance-options" src/
```

Expected: No matches.

- [ ] **Step 12: Run typecheck**

Run: `pnpm tsc --noEmit`
Expected: PASS

- [ ] **Step 13: Commit**

```bash
git add -A src/shared/dal/ src/features/*/dal/ src/trpc/routers/ src/features/proposal-flow/ src/features/agent-dashboard/ src/app/
git commit -m "refactor: move single-feature DAL from shared/ to feature directories"
```

---

## Task 2: Fix `shared/services/` -> `features/` Import Violations

**Why:** `shared/services/` (monday, pipedrive, AI) import form schemas from features. Since `shared/` cannot import from `features/`, these schemas must be moved to `shared/entities/`.

**Note:** tRPC routers importing from features is now acceptable (glue layer), so only `shared/services/` violations remain.

**Files:**
- Create: `src/shared/entities/landing/schemas.ts`
- Modify: `src/features/landing/schemas/general-inquiry-form.ts` (re-export from shared)
- Modify: `src/features/landing/schemas/schedule-consultation-form.ts` (re-export from shared)
- Modify: `src/shared/services/monday/api/put-lead.ts:1` (fix import)
- Modify: `src/shared/services/pipedrive/api/put-lead.ts:1` (fix import)
- Modify: `src/shared/services/ai/generate-project-summary.ts:1` (fix import)
- Modify: `src/shared/services/upstash/jobs/generate-ai-summary.ts:1` (fix import)

- [ ] **Step 1: Read both landing schemas and the proposal form schema**

Read `src/features/landing/schemas/general-inquiry-form.ts`, `src/features/landing/schemas/schedule-consultation-form.ts`, and check what `src/shared/services/ai/generate-project-summary.ts` imports.

- [ ] **Step 2: Create `src/shared/entities/landing/schemas.ts`**

Move `generalInquiryFormSchema`, `GeneralInquiryFormSchema`, `defaultValues` (rename to `generalInquiryDefaults`), and `scheduleConsultationFormSchema` + its type here.

- [ ] **Step 3: Update feature schemas to re-export from shared**

`src/features/landing/schemas/general-inquiry-form.ts`:
```typescript
export { generalInquiryFormSchema, type GeneralInquiryFormSchema, generalInquiryDefaults as defaultValues } from '@/shared/entities/landing/schemas'
```

Same pattern for `schedule-consultation-form.ts`.

- [ ] **Step 4: Move `ProposalFormSchema` to shared entities**

If `src/shared/services/ai/generate-project-summary.ts` imports `ProposalFormSchema` from `@/features/proposal-flow/schemas/form-schema`, move the schema to `src/shared/entities/proposals/schemas.ts` and create a re-export in the feature file.

- [ ] **Step 5: Update all shared service imports**

- `src/shared/services/monday/api/put-lead.ts:1` -> `from '@/shared/entities/landing/schemas'`
- `src/shared/services/pipedrive/api/put-lead.ts:1` -> `from '@/shared/entities/landing/schemas'`
- `src/shared/services/ai/generate-project-summary.ts:1` -> `from '@/shared/entities/proposals/schemas'`
- `src/shared/services/upstash/jobs/generate-ai-summary.ts:1` -> `from '@/shared/entities/proposals/schemas'`

- [ ] **Step 6: Verify no remaining `shared/` -> `features/` imports**

```bash
grep -r "from '@/features" src/shared/
```

Expected: No matches (CTA handled separately in Task 4).

Wait — `src/shared/components/cta.tsx` will still import from `features/landing/`. Handle in Task 4.

Expected: Only `cta.tsx` matches remain.

- [ ] **Step 7: Run typecheck and commit**

Run: `pnpm tsc --noEmit`

```bash
git add src/shared/entities/landing/ src/shared/entities/proposals/ src/features/landing/schemas/ src/shared/services/
git commit -m "refactor: move landing + proposal schemas to shared/entities/ for shared service access"
```

---

## Task 3: Move Company Data to `shared/constants/`

**Why:** `src/shared/components/footer.tsx`, `site-navbar.tsx`, `old-logo.tsx`, `company-social-buttons.tsx` import `companyInfo` and `footerData` from `features/landing/data/`. Shared layout components must not depend on features.

**Complexity note:** `companyInfo` is composed from 8 sub-modules in `features/landing/data/company/` (`awards`, `certifications`, `contactInfo`, `insurances`, `licenses`, `socials`, `teamInfo`, `testimonials`). The entire directory must move.

**Files:**
- Move: `src/features/landing/data/company/` -> `src/shared/constants/company/`
- Move: `src/features/landing/data/footer.ts` -> `src/shared/constants/footer.ts`
- Create: Re-export files at old locations for backward compat
- Modify: Shared component imports (footer, navbar, old-logo, social buttons)

- [ ] **Step 1: Read all files in `src/features/landing/data/company/` and `footer.ts`**

- [ ] **Step 2: Move the entire `data/company/` directory to shared**

```bash
git mv src/features/landing/data/company/ src/shared/constants/company/
```

Internal relative imports (`./awards`, etc.) still work after move.

- [ ] **Step 3: Move `footer.ts` to shared**

```bash
git mv src/features/landing/data/footer.ts src/shared/constants/footer.ts
```

If `footer.ts` imports from `./company`, update to `@/shared/constants/company`.

- [ ] **Step 4: Create re-export stubs at ALL old import paths**

After `git mv`, consumers importing from sub-file paths (e.g., `@/features/landing/data/company/services`) will break. Create re-export stubs for every sub-file that has external consumers:

Create `src/features/landing/data/company/index.ts`:
```typescript
export { companyInfo, awards, certifications, contactInfo, insurances, licenses, socials, teamInfo, testimonials } from '@/shared/constants/company'
```

Create individual re-export stubs for sub-files with direct consumers:
- `src/features/landing/data/company/services.ts` -> `export { services } from '@/shared/constants/company/services'`
- `src/features/landing/data/company/credentials.ts` -> `export { credentials } from '@/shared/constants/company/credentials'`
- `src/features/landing/data/company/stats.ts` -> `export { stats } from '@/shared/constants/company/stats'`
- `src/features/landing/data/company/team-members.ts` -> `export { teamMembers } from '@/shared/constants/company/team-members'`

Consumers of these sub-files (all in `features/landing/` and `src/app/`):
- `src/app/(frontend)/(site)/services/[serviceId]/page.tsx` -> imports `services`
- `src/features/landing/ui/components/home/services-preview.tsx` -> imports `services`
- `src/features/landing/ui/components/services/service-card.tsx` -> imports `services` (type)
- `src/features/landing/ui/components/services/services-list.tsx` -> imports `services`
- `src/features/landing/ui/components/services/services-list-scroll.tsx` -> imports `services`
- `src/features/landing/ui/components/about/team.tsx` -> imports `teamMembers`
- `src/features/landing/ui/components/about/credentials.tsx` -> imports `credentials`, `stats`

Create `src/features/landing/data/footer.ts`:
```typescript
export { footerData } from '@/shared/constants/footer'
```

- [ ] **Step 5: Update all shared component imports**

- `src/shared/components/footer.tsx` -> `from '@/shared/constants/company'` and `from '@/shared/constants/footer'`
- `src/shared/components/navigation/site-navbar.tsx` -> `from '@/shared/constants/company'`
- `src/shared/components/old-logo.tsx` -> `from '@/shared/constants/company'`
- `src/shared/components/company-social-buttons.tsx` -> `from '@/shared/constants/company'`

- [ ] **Step 6: Verify and commit**

Run: `grep -r "from '@/features/landing" src/shared/` — should only show `cta.tsx` (handled in Task 4).
Run: `pnpm tsc --noEmit`

```bash
git add src/shared/constants/company/ src/shared/constants/footer.ts src/features/landing/data/ src/shared/components/
git commit -m "refactor: move company + footer data to shared/constants/ for layout components"
```

---

## Task 4: Fix CTA Component Import Violation

**Why:** `src/shared/components/cta.tsx` imports form components from `features/landing/`. CTA is used by app pages, landing, and showroom — it's a true shared component. The form components must move to shared.

**Also:** `cta.tsx` uses `export default` — must convert to named export.

**Files:**
- Move: Contact form components to `src/shared/components/forms/`
- Create: Re-export files at old locations
- Modify: `src/shared/components/cta.tsx` (fix imports + named export)
- Modify: All consumers of `BottomCTA`

- [ ] **Step 1: Move form components to shared**

```bash
mkdir -p src/shared/components/forms
git mv src/features/landing/ui/components/contact/general-inquiry-form.tsx src/shared/components/forms/
git mv src/features/landing/ui/components/contact/schedule-consultation-form.tsx src/shared/components/forms/
```

Update imports inside moved files to use `@/shared/entities/landing/schemas` (from Task 2).

- [ ] **Step 2: Create re-exports at old locations**

In `src/features/landing/ui/components/contact/general-inquiry-form.tsx`:
```typescript
export { GeneralInquiryForm } from '@/shared/components/forms/general-inquiry-form'
```

Same for `schedule-consultation-form.tsx`.

- [ ] **Step 3: Fix `cta.tsx` imports and convert to named export**

Change default imports to named imports from shared locations. Change `export default function BottomCTA` to `export function BottomCTA`.

- [ ] **Step 4: Update all CTA consumers and contact-hero.tsx to named imports**

Search: `grep -r "BottomCTA\|from.*cta" src/` and change `import BottomCTA from` to `import { BottomCTA } from`.

Also update `src/features/landing/ui/components/contact/contact-hero.tsx` which imports the form components via default imports — change to named imports pointing to the re-export stubs (or directly to `@/shared/components/forms/`).

- [ ] **Step 5: Verify and commit**

Run: `grep -r "from '@/features" src/shared/` — expected: zero matches.
Run: `pnpm tsc --noEmit`

```bash
git add src/shared/components/forms/ src/shared/components/cta.tsx src/features/landing/ui/components/contact/ src/app/ src/features/
git commit -m "refactor: move contact forms to shared, convert CTA to named export"
```

---

## Task 5: Fix `Record<string, unknown>` JSONB Type Violations

**Why:** `getJsonbSection` and callers use `Record<string, unknown>` for typed JSONB fields that have well-defined entity types.

**Files:**
- Create: `src/shared/types/jsonb.ts` (typed JSONB section map)
- Modify: `src/features/meetings/lib/get-jsonb-section.ts`

- [ ] **Step 1: Create `src/shared/types/jsonb.ts`**

```typescript
import type { CustomerProfile, FinancialProfile, PropertyProfile } from '@/shared/entities/customers/schemas'
import type { ProgramData, SituationProfile } from '@/shared/entities/meetings/schemas'

export type JsonbSection =
  | 'customerProfileJSON'
  | 'financialProfileJSON'
  | 'programDataJSON'
  | 'propertyProfileJSON'
  | 'situationProfileJSON'

export interface JsonbSectionMap {
  customerProfileJSON: CustomerProfile
  financialProfileJSON: FinancialProfile
  propertyProfileJSON: PropertyProfile
  situationProfileJSON: SituationProfile
  programDataJSON: ProgramData
}
```

- [ ] **Step 2: Update `getJsonbSection` to use typed generics**

In `src/features/meetings/lib/get-jsonb-section.ts`:

```typescript
import type { JsonbSection, JsonbSectionMap } from '@/shared/types/jsonb'

export function getJsonbSection<K extends JsonbSection>(
  source: Record<string, unknown> | null,
  jsonbKey: K,
): Partial<JsonbSectionMap[K]> {
  if (!source) return {} as Partial<JsonbSectionMap[K]>
  const section = source[jsonbKey]
  return (section as Partial<JsonbSectionMap[K]> | null | undefined) ?? {} as Partial<JsonbSectionMap[K]>
}
```

- [ ] **Step 3: Update `JsonbSection` re-export in `meetings/types/index.ts`**

Change the `JsonbSection` type definition to a re-export:
```typescript
export type { JsonbSection } from '@/shared/types/jsonb'
```

- [ ] **Step 4: Run typecheck and commit**

Run: `pnpm tsc --noEmit`

```bash
git add src/shared/types/jsonb.ts src/features/meetings/
git commit -m "fix: add typed JSONB section map, replace Record<string, unknown> in getJsonbSection"
```

---

## Task 6: Fix Type Derivation Violations

**Why:** Several types hand-roll fields from Drizzle schemas, weakening enum types to bare `string`. These should derive from source-of-truth types using `Pick<>`.

**Files:**
- Modify: `src/features/pipeline/types/index.ts` (lines 37-57)
- Modify: `src/features/meetings/types/index.ts` (lines 49-67)

- [ ] **Step 1: Fix `CustomerProfileMeeting` and `CustomerProfileProposal`**

In `src/features/pipeline/types/index.ts`, replace the hand-rolled interfaces:

```typescript
import type { Customer, Meeting, Proposal } from '@/shared/db/schema'

export type CustomerProfileMeeting =
  Pick<Meeting, 'id' | 'program' | 'status' | 'scheduledFor' | 'createdAt'>
  & { proposals: CustomerProfileProposal[] }

export type CustomerProfileProposal =
  Pick<Proposal, 'id' | 'label' | 'status' | 'sentAt' | 'contractSentAt' | 'meetingId' | 'createdAt'>
  & { trade: string | null; value: number | null; viewCount: number }
```

This preserves the `MeetingStatus` and `ProposalStatus` enum types instead of widening to `string`.

- [ ] **Step 2: Fix `MeetingContext.customer`**

In `src/features/meetings/types/index.ts`, replace the hand-rolled customer shape:

```typescript
import type { Customer } from '@/shared/db/schema'

export interface MeetingContext {
  collectedData: {
    bill: string
    dmsPresent: string
    scope: string
    timeline: string
    triggerEvent: string
    yrs: string
  }
  customer: Pick<Customer, 'id' | 'name' | 'address' | 'city' | 'email' | 'phone' | 'state'> | null
}
```

- [ ] **Step 3: Verify DAL return types match**

Read the pipeline DAL files (now in `src/features/pipeline/dal/server/`) and confirm `.select()` returns are compatible with the new `Pick<>` types.

- [ ] **Step 4: Run typecheck and commit**

Run: `pnpm tsc --noEmit`

```bash
git add src/features/pipeline/types/ src/features/meetings/types/
git commit -m "fix: derive pipeline/meeting types from Drizzle schemas instead of hand-rolling"
```

---

## Task 7: Merge Portfolio Feature into Showroom

**Why:** Portfolio (agent editor) and showroom (public showcase) are two halves of the same feature. They share the same tRPC router (`showroomRouter`), entities, and DAL. Merging under `showroom/` eliminates naming confusion.

**Files:**
- Move: All files from `src/features/portfolio/` into `src/features/showroom/`
- Modify: `src/features/agent-dashboard/ui/views/dashboard-hub.tsx:15-17`
- Delete: `src/features/portfolio/` after move

- [ ] **Step 1: Verify all portfolio consumers**

```bash
grep -r "from '@/features/portfolio" src/
```

- [ ] **Step 2: Move all portfolio files to showroom using `git mv`**

```bash
# Constants
git mv src/features/portfolio/constants/table-filter-config.ts src/features/showroom/constants/

# Hooks
git mv src/features/portfolio/hooks/use-project-actions.ts src/features/showroom/hooks/

# Lib
git mv src/features/portfolio/lib/group-scopes-by-trade.ts src/features/showroom/lib/

# Form components
mkdir -p src/features/showroom/ui/components/form
git mv src/features/portfolio/ui/components/form/index.tsx src/features/showroom/ui/components/form/
git mv src/features/portfolio/ui/components/form/basic-info-fields.tsx src/features/showroom/ui/components/form/
git mv src/features/portfolio/ui/components/form/homeowner-fields.tsx src/features/showroom/ui/components/form/
git mv src/features/portfolio/ui/components/form/story-content-fields.tsx src/features/showroom/ui/components/form/
git mv src/features/portfolio/ui/components/form/metadata-tab-content.tsx src/features/showroom/ui/components/form/
git mv src/features/portfolio/ui/components/form/photos-tab-content.tsx src/features/showroom/ui/components/form/
git mv src/features/portfolio/ui/components/form/trade-scope-row.tsx src/features/showroom/ui/components/form/
git mv src/features/portfolio/ui/components/form/trade-scope-picker-fields.tsx src/features/showroom/ui/components/form/

# Table components
mkdir -p src/features/showroom/ui/components/table
git mv src/features/portfolio/ui/components/table/index.tsx src/features/showroom/ui/components/table/
git mv src/features/portfolio/ui/components/table/columns.tsx src/features/showroom/ui/components/table/

# Views
git mv src/features/portfolio/ui/views/portfolio-projects-view.tsx src/features/showroom/ui/views/
git mv src/features/portfolio/ui/views/create-project-view.tsx src/features/showroom/ui/views/
git mv src/features/portfolio/ui/views/edit-project-view.tsx src/features/showroom/ui/views/
```

- [ ] **Step 3: Update internal imports in moved files**

Every moved file importing from `@/features/portfolio/` must update to `@/features/showroom/`:
- `views/portfolio-projects-view.tsx`
- `views/create-project-view.tsx`
- `views/edit-project-view.tsx`
- Any table/form file with cross-references

- [ ] **Step 4: Update dashboard-hub.tsx imports**

```typescript
// Before:
import { CreateProjectView } from '@/features/portfolio/ui/views/create-project-view'
import { EditProjectView } from '@/features/portfolio/ui/views/edit-project-view'
import { PortfolioProjectsView } from '@/features/portfolio/ui/views/portfolio-projects-view'

// After:
import { CreateProjectView } from '@/features/showroom/ui/views/create-project-view'
import { EditProjectView } from '@/features/showroom/ui/views/edit-project-view'
import { PortfolioProjectsView } from '@/features/showroom/ui/views/portfolio-projects-view'
```

- [ ] **Step 5: Remove empty portfolio directory**

```bash
find src/features/portfolio/ -type d -empty -delete 2>/dev/null
rm -rf src/features/portfolio/
```

- [ ] **Step 6: Verify and commit**

```bash
grep -r "features/portfolio" src/
```
Expected: No matches.

Run: `pnpm tsc --noEmit`

```bash
git add -A src/features/portfolio/ src/features/showroom/ src/features/agent-dashboard/ui/views/dashboard-hub.tsx
git commit -m "refactor: merge portfolio feature into showroom as unified feature"
```

---

## Task 8: Fix Showroom Feature Architecture Violations

**Why:** After merge, the showroom feature has multi-component files, file-level constants in .tsx, and inconsistent relative imports.

**Files:**
- Create: `src/features/showroom/ui/components/phase-carousel.tsx`
- Create: `src/features/showroom/constants/phase-labels.ts`
- Create: `src/features/showroom/constants/phase-config.ts`
- Modify: `src/features/showroom/ui/components/story-timeline.tsx`
- Modify: `src/features/showroom/ui/components/story-gallery.tsx`
- Modify: showroom view + component files (fix relative imports to `@/` alias)

- [ ] **Step 1: Extract `PhaseCarousel` from `story-timeline.tsx`**

Move `PhaseCarousel` (lines ~119-202) + `PhaseCarouselProps` to `src/features/showroom/ui/components/phase-carousel.tsx`.

- [ ] **Step 2: Extract `PHASE_CONFIG` to `src/features/showroom/constants/phase-config.ts`**

- [ ] **Step 3: Extract `PHASE_LABELS` to `src/features/showroom/constants/phase-labels.ts`**

Move from `story-gallery.tsx` line 13.

- [ ] **Step 4: Update parent files to import from new locations**

- [ ] **Step 5: Fix relative imports to `@/` alias**

In `showroom-grid-view.tsx`, `showroom-project-view.tsx`, `story-journey.tsx`, and any other files using relative imports like `../../constants/` or `../components/` — change to `@/features/showroom/...`.

- [ ] **Step 6: Run typecheck and commit**

Run: `pnpm tsc --noEmit`

```bash
git add src/features/showroom/
git commit -m "refactor: fix showroom architecture (extract components, constants, fix imports)"
```

---

## Task 9: Fix Agent Dashboard Architecture Violations

**Why:** Duplicate `tierColorMap` in two component files, `groupByTier` helper in a view file.

**Files:**
- Create: `src/features/agent-dashboard/constants/tier-color-map.ts`
- Create: `src/features/agent-dashboard/lib/group-items-by-tier.ts`
- Modify: `action-card.tsx`, `action-detail-sheet.tsx`, `action-center-view.tsx`

- [ ] **Step 1: Create `src/features/agent-dashboard/constants/tier-color-map.ts`**

```typescript
export const tierColorMap: Record<string, string> = {
  red: 'bg-red-500/10 text-red-500 border-red-500/20',
  orange: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  yellow: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  muted: 'bg-muted text-muted-foreground border-muted',
}
```

- [ ] **Step 2: Create `src/features/agent-dashboard/lib/group-items-by-tier.ts`**

Move `groupByTier` function from `action-center-view.tsx` lines 19-30.

- [ ] **Step 3: Update component/view files**

- `action-card.tsx`: Remove `tierColorMap`, add import from `@/features/agent-dashboard/constants/tier-color-map`
- `action-detail-sheet.tsx`: Same
- `action-center-view.tsx`: Remove `groupByTier`, add import from `@/features/agent-dashboard/lib/group-items-by-tier`

- [ ] **Step 4: Run typecheck and commit**

Run: `pnpm tsc --noEmit`

```bash
git add src/features/agent-dashboard/
git commit -m "refactor: extract tierColorMap + groupByTier from component/view files"
```

---

## Task 10: Convert Landing Feature Default Exports

**Why:** 18 files in `src/features/landing/ui/components/` use `export default` instead of named exports.

**Files:** All 18 landing component files + all their consumers.

Landing files:
1. `blog/blog-hero.tsx`
2. `home/past-projects.tsx`
3. `home/testimonials.tsx`
4. `home/home-hero.tsx`
5. `home/value-proposition.tsx`
6. `home/services-preview.tsx`
7. `services/service-hero.tsx`
8. `services/service-card.tsx`
9. `services/services-list.tsx`
10. `services/services-list-scroll.tsx`
11. `about/team.tsx`
12. `about/credentials.tsx`
13. `about/about-hero.tsx`
14. `about/company-story.tsx`
15. `contact/contact-info.tsx`
16. `contact/schedule-consultation-form.tsx` (may already be in shared from Task 4)
17. `contact/contact-hero.tsx`
18. `contact/general-inquiry-form.tsx` (may already be in shared from Task 4)

- [ ] **Step 1: For each file, change `export default function X` to `export function X`**

- [ ] **Step 2: Find and update all importers to named imports**

For each file, search consumers and change `import X from` to `import { X } from`.

Stage ALL affected files including `src/app/`, `src/features/showroom/`, and any shared files.

- [ ] **Step 3: Run typecheck and commit**

Run: `pnpm tsc --noEmit`

```bash
git add src/features/landing/ src/app/ src/features/showroom/
git commit -m "refactor: convert all landing components from default to named exports"
```

---

## Task 11: Fix Remaining Multi-Component Files

**Why:** Several files export multiple React components (one-component-per-file rule).

**Files:**
- Extract: `StatCard` from `src/features/pipeline/ui/components/customer-profile-overview.tsx`
- Extract: `Stat` from `src/features/landing/ui/components/portfolio/project/project-backstory.tsx`
- Extract: `ProposalViewBadge` from `src/features/proposal-flow/ui/views/my-proposals-dashboard-view.tsx`

(Note: `blogpost-card.tsx` compound component pattern — intentional, document exception.)

- [ ] **Step 1: Extract `StatCard`**

Create `src/features/pipeline/ui/components/stat-card.tsx`. Update `customer-profile-overview.tsx` to import from `./stat-card`.

- [ ] **Step 2: Extract `Stat`**

Create `src/features/landing/ui/components/portfolio/project/stat.tsx`. Update `project-backstory.tsx`.

- [ ] **Step 3: Extract `ProposalViewBadge`**

Create `src/features/proposal-flow/ui/components/proposal-view-badge.tsx`. Update `my-proposals-dashboard-view.tsx`.

- [ ] **Step 4: Run typecheck and commit**

Run: `pnpm tsc --noEmit`

```bash
git add src/features/pipeline/ui/components/ src/features/landing/ui/components/ src/features/proposal-flow/ui/
git commit -m "refactor: extract inline sub-components to own files"
```

---

## Task 12: Final Verification

- [ ] **Step 1: Run full import directionality check**

```bash
grep -r "from '@/features" src/shared/
```

Expected: Zero matches.

- [ ] **Step 2: Verify feature DAL structure**

```bash
find src/features/*/dal -type f 2>/dev/null | sort
```

Expected:
```
src/features/agent-dashboard/dal/server/get-action-queue.ts
src/features/agent-dashboard/dal/server/get-pipeline-items.ts
src/features/agent-dashboard/dal/server/get-pipeline-stats.ts
src/features/agent-dashboard/dal/server/move-pipeline-item.ts
src/features/landing/dal/server/projects.ts
src/features/pipeline/dal/server/get-customer-pipeline-items.ts
src/features/pipeline/dal/server/get-customer-profile.ts
src/features/pipeline/dal/server/move-customer-pipeline-item.ts
src/features/proposal-flow/dal/client/mutations/use-create-proposal.ts
src/features/proposal-flow/dal/client/mutations/use-send-proposal-email.ts
src/features/proposal-flow/dal/client/mutations/use-update-proposal.ts
src/features/proposal-flow/dal/client/queries/use-get-finance-options.ts
src/features/proposal-flow/dal/client/queries/use-get-proposal.ts
src/features/proposal-flow/dal/client/queries/use-get-proposals.ts
src/features/showroom/dal/server/get-project-for-edit.ts
src/features/showroom/dal/server/get-showroom-project-detail.ts
src/features/showroom/dal/server/get-showroom-projects.ts
src/features/showroom/dal/server/manage-project.ts
```

- [ ] **Step 3: Verify shared DAL only has cross-feature files**

```bash
find src/shared/dal -type f | sort
```

Expected:
```
src/shared/dal/server/customers/api.ts
src/shared/dal/server/finance-options/api.ts
src/shared/dal/server/proposals/api.ts
src/shared/dal/server/proposals/proposal-views.ts
```

- [ ] **Step 4: Verify merged showroom feature structure**

```bash
find src/features/showroom -type f | sort
```

Expected: Unified feature with `constants/`, `dal/server/`, `hooks/`, `lib/`, `ui/components/`, `ui/views/`.

- [ ] **Step 5: Verify `@/features/portfolio` is fully gone**

```bash
grep -r "portfolio" src/features/ --include="*.ts" --include="*.tsx" -l
```

Expected: Only `showroom/ui/views/portfolio-projects-view.tsx` (filename, not import).

- [ ] **Step 6: Run typecheck**

Run: `pnpm tsc --noEmit`

- [ ] **Step 7: Run lint**

Run: `pnpm lint`

- [ ] **Step 8: Run dev server**

Run: `pnpm dev` — verify no runtime errors.
