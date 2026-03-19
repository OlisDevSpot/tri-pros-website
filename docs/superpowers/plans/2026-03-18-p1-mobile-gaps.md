# P1 Mobile Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two mobile UX gaps: make showroom projects manageable on mobile via a slide-in detail sheet, and condense the footer (~40-50% height reduction) while removing dead sections and fixing bugs.

**Architecture:** Fix 1 introduces a shared `BaseSheet` contract component (mirrors existing `BaseModal` pattern), then a feature-specific `ProjectDetailSheet` that consumes it — wired into the showroom table via the DataTable's existing `onRowClick` and `activeRowId` mechanisms. Fix 2 is pure surgery on `footer.tsx` and `footer.ts` — remove dead section, condense spacing, fix typo, replace hardcoded URLs with `ROOTS` calls.

**Tech Stack:** Next.js 15, React 19, shadcn/ui Sheet primitives (`@radix-ui/react-dialog`), Tailwind v4, tRPC + TanStack Query, TypeScript strict mode, pnpm.

---

## File Map

**Fix 1 — Showroom Mobile Sheet:**
| Action | File | Responsibility |
|---|---|---|
| Create | `src/shared/components/dialogs/sheets/base-sheet.tsx` | Shared sheet contract component (mirrors `BaseModal`) |
| Create | `src/features/showroom/ui/components/project-detail-sheet.tsx` | Feature-specific sheet with project detail + actions |
| Modify | `src/features/showroom/ui/components/table/columns.tsx` | Export `ProjectRow` type; add `activeRowId` to meta interface; add `isActive` reveal |
| Modify | `src/features/showroom/ui/components/table/index.tsx` | Remove duplicate type; add + pass `onRowClick` prop |
| Modify | `src/features/showroom/ui/views/portfolio-projects-view.tsx` | Add sheet state, wire `onRowClick`, render `ProjectDetailSheet` |

**Fix 2 — Footer:**
| Action | File | Responsibility |
|---|---|---|
| Modify | `src/shared/constants/footer.ts` | Replace all hardcoded URLs with `ROOTS.landing.*()` calls |
| Modify | `src/shared/components/footer.tsx` | Remove newsletter section; condense all spacing; fix copyright typo |

---

## Important Context Before Starting

**No test files exist in this codebase.** The validation step for every task is:
```bash
pnpm lint && pnpm build
```
Expected: 0 lint errors, successful TypeScript compilation.

**DataTable already manages `activeRowId` internally.** It injects `{ ...meta, activeRowId }` into `table.options.meta`. You just need to declare `activeRowId` in `ProjectTableMeta` so TypeScript accepts the cast.

**`ProjectRow` is currently defined twice** (in `columns.tsx` and `table/index.tsx`). After Task 3, it lives only in `columns.tsx` (exported), and `table/index.tsx` imports it from there.

**ROOTS functions return strings** — use them directly as `href` values in `footerData`.

---

## Fix 1: Showroom Projects Mobile Sheet

---

### Task 1: Create `BaseSheet` shared contract component

**Files:**
- Create: `src/shared/components/dialogs/sheets/base-sheet.tsx`

**Reference:** Mirror the exact structure of `src/shared/components/dialogs/modals/base-modal.tsx`. The Sheet primitives are in `src/shared/components/ui/sheet.tsx`.

- [ ] **Step 1: Create the file**

```typescript
// src/shared/components/dialogs/sheets/base-sheet.tsx
'use client'

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/shared/components/ui/sheet'

interface BaseSheetProps {
  close: () => void
  isOpen: boolean
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
}

export function BaseSheet({
  close,
  isOpen,
  title,
  description,
  children,
  className,
  side = 'right',
}: BaseSheetProps) {
  return (
    <Sheet open={isOpen} onOpenChange={close}>
      <SheetContent side={side} className={className}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description != null && (
            <SheetDescription>
              {typeof description === 'string' ? description : <div>{description}</div>}
            </SheetDescription>
          )}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Verify lint + types pass**

```bash
cd /path/to/project && pnpm lint src/shared/components/dialogs/sheets/base-sheet.tsx
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/shared/components/dialogs/sheets/base-sheet.tsx
git commit -m "feat(shared): add BaseSheet contract component mirroring BaseModal"
```

---

### Task 2: Create `ProjectDetailSheet` feature component

**Files:**
- Create: `src/features/showroom/ui/components/project-detail-sheet.tsx`

**Reference:** `ProjectRow` type (will be exported from `columns.tsx` in Task 3 — define it inline for now or do Task 3 first). Navigation pattern: `ROOTS.dashboard.root` + query string for edit; `ROOTS.landing.portfolioProjects()` + accessor for view.

**Important:** The `project` prop is `ProjectRow | null`. When null, the sheet renders nothing meaningful — always guard all accesses with `project &&` or render nothing.

- [ ] **Step 1: Check what fields `ProjectRow` has before coding**

Read `src/features/showroom/ui/components/table/columns.tsx` lines 15–17 to confirm:
```typescript
type ProjectRow = inferRouterOutputs<AppRouter>['showroomRouter']['getAllProjects'][number] & {
  tradeNames: string[]
}
```
Fields available: `id`, `title`, `description`, `city`, `state`, `isPublic`, `completedAt`, `createdAt`, `accessor`, `scopeIds`, `tradeNames`.

- [ ] **Step 2: Create the file**

```typescript
// src/features/showroom/ui/components/project-detail-sheet.tsx
'use client'

import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@/trpc/routers/app'

import { useRouter } from 'next/navigation'
import { BaseSheet } from '@/shared/components/dialogs/sheets/base-sheet'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'
import { cn } from '@/shared/lib/utils'

type ProjectRow = inferRouterOutputs<AppRouter>['showroomRouter']['getAllProjects'][number] & {
  tradeNames: string[]
}

interface ProjectDetailSheetProps {
  project: ProjectRow | null
  isOpen: boolean
  close: () => void
  onDelete?: () => void
}

export function ProjectDetailSheet({ project, isOpen, close, onDelete }: ProjectDetailSheetProps) {
  const router = useRouter()

  const location = project
    ? (project.state ? `${project.city}, ${project.state}` : project.city)
    : null

  return (
    <BaseSheet
      isOpen={isOpen}
      close={close}
      title={project?.title ?? ''}
      description={location ?? undefined}
    >
      {project && (
        <div className="flex flex-col gap-6 pt-2">
          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
            <Badge
              className={cn(
                'w-fit text-xs',
                project.isPublic
                  ? 'bg-emerald-500/15 text-emerald-700'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {project.isPublic ? 'Public' : 'Draft'}
            </Badge>
          </div>

          {/* Completion date */}
          {project.completedAt && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Completed</p>
              <p className="text-sm">
                {new Date(project.completedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          )}

          {/* Trade names */}
          {project.tradeNames.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Trades</p>
              <div className="flex flex-wrap gap-1.5">
                {project.tradeNames.map(name => (
                  <Badge key={name} variant="outline" className="text-xs">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2 border-t">
            <Button
              className="w-full"
              onClick={() => {
                close()
                router.push(`${ROOTS.dashboard.root}?step=edit-project&editProjectId=${project.id}`)
              }}
            >
              Edit Project
            </Button>
            {project.isPublic && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  window.open(`${ROOTS.landing.portfolioProjects()}/${project.accessor}`, '_blank')
                }}
              >
                View on Site
              </Button>
            )}
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => {
                // eslint-disable-next-line no-alert
                if (window.confirm('Are you sure you want to delete this project?')) {
                  close()
                  onDelete?.()
                }
              }}
            >
              Delete Project
            </Button>
          </div>
        </div>
      )}
    </BaseSheet>
  )
}
```

The `onDelete` prop is wired in Task 5 (the view calls `deleteProject.mutate({ id: selectedProject.id })` and passes it as `onDelete`). This task just declares the prop and calls it — the component itself never touches the mutation directly.

- [ ] **Step 3: Verify lint + types pass**

```bash
pnpm lint src/features/showroom/ui/components/project-detail-sheet.tsx
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/showroom/ui/components/project-detail-sheet.tsx
git commit -m "feat(showroom): add ProjectDetailSheet for mobile project management"
```

---

### Task 3: Update `columns.tsx` — export type + add `activeRowId` + `isActive`

**Files:**
- Modify: `src/features/showroom/ui/components/table/columns.tsx`

**Changes needed:**
1. Add `export` to `type ProjectRow`
2. Add `activeRowId: string | null` to `ProjectTableMeta` interface
3. Compute `isActive` in the title cell and apply to the action button container

- [ ] **Step 1: Read the file first**

Read `src/features/showroom/ui/components/table/columns.tsx` (already done in context — lines 15–53).

- [ ] **Step 2: Export `ProjectRow` and add `activeRowId` to meta**

Change line 15 from:
```typescript
type ProjectRow = inferRouterOutputs<AppRouter>['showroomRouter']['getAllProjects'][number] & {
  tradeNames: string[]
}
```
To:
```typescript
export type ProjectRow = inferRouterOutputs<AppRouter>['showroomRouter']['getAllProjects'][number] & {
  tradeNames: string[]
}
```

Change `ProjectTableMeta` (lines 19–22) from:
```typescript
export interface ProjectTableMeta {
  onDelete: (projectId: string) => void
  isDeleting: boolean
}
```
To:
```typescript
export interface ProjectTableMeta {
  activeRowId: string | null
  onDelete: (projectId: string) => void
  isDeleting: boolean
}
```

- [ ] **Step 3: Add `isActive` to the action button container in the title cell**

> ⚠️ **Spec correction:** The spec (line 129) shows `meta?.activeRowId === row.original.project.id` — this is **wrong**. `ProjectRow` is a flat router output; there is no `.project` nesting. The DataTable also uses `row.original.id` internally when setting `activeRowId`. Use `row.original.id` as shown below.

In the title `cell` renderer, the action button `div` currently is (lines 49–54):
```typescript
<div
  className={cn(
    'flex items-center gap-1 shrink-0 opacity-0 pointer-events-none transition-opacity duration-150',
    'group-hover:opacity-100 group-hover:pointer-events-auto',
  )}
  onClick={e => e.stopPropagation()}
>
```

Add `isActive` computation before the return, and apply the conditional class:
```typescript
cell: ({ row, table }) => {
  const meta = table.options.meta as ProjectTableMeta | undefined
  const isActive = meta?.activeRowId === row.original.id

  return (
    <div className="flex items-center justify-between gap-4">
      {/* ... tooltip and title content unchanged ... */}
      <div
        className={cn(
          'flex items-center gap-1 shrink-0 opacity-0 pointer-events-none transition-opacity duration-150',
          'group-hover:opacity-100 group-hover:pointer-events-auto',
          isActive && 'opacity-100 pointer-events-auto',
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* existing action buttons unchanged */}
      </div>
    </div>
  )
},
```

- [ ] **Step 4: Verify lint + types**

```bash
pnpm lint src/features/showroom/ui/components/table/columns.tsx
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/showroom/ui/components/table/columns.tsx
git commit -m "feat(showroom): export ProjectRow, add activeRowId to meta, add isActive reveal"
```

---

### Task 4: Update `table/index.tsx` — remove duplicate type, add `onRowClick` prop

**Files:**
- Modify: `src/features/showroom/ui/components/table/index.tsx`

**Changes needed:**
1. Remove the duplicate `type ProjectRow = ...` definition (now imported from `columns.tsx`)
2. Add `onRowClick?: (row: ProjectRow) => void` to `Props`
3. Pass `onRowClick` through to `DataTable`

- [ ] **Step 1: Read the file**

Read `src/features/showroom/ui/components/table/index.tsx` (already done in context).

- [ ] **Step 2: Apply changes**

Remove lines 13–15 (the local `ProjectRow` type). Then merge the type import into the existing `import { getColumns } from './columns'` line — **do not add a second `from './columns'` line** (the `import/no-duplicates` lint rule will fail).

Change:
```typescript
import { getColumns } from './columns'
```
To:
```typescript
import { type ProjectRow, getColumns } from './columns'
```

Update `Props`:
```typescript
interface Props {
  data: ProjectRow[]
  tradeFilter?: DataTableMultiSelectFilter
  onFilteredCountChange?: (count: number) => void
  onRowClick?: (row: ProjectRow) => void
}
```

Update component signature and DataTable call:
```typescript
export function PortfolioProjectsTable({ data, tradeFilter, onFilteredCountChange, onRowClick }: Props) {
  // ...existing code...
  return (
    <DataTable
      data={data}
      columns={columns}
      meta={meta}
      filterConfig={filterConfig}
      defaultSort={defaultSort}
      entityName="project"
      rowDataAttribute="data-project-row"
      onFilteredCountChange={onFilteredCountChange}
      onRowClick={onRowClick}
    />
  )
}
```

- [ ] **Step 3: Verify lint + types**

```bash
pnpm lint src/features/showroom/ui/components/table/index.tsx
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/showroom/ui/components/table/index.tsx
git commit -m "feat(showroom): expose onRowClick prop on PortfolioProjectsTable"
```

---

### Task 5: Wire sheet into `portfolio-projects-view.tsx`

**Files:**
- Modify: `src/features/showroom/ui/views/portfolio-projects-view.tsx`

**Changes needed:**
1. Import `ProjectRow` from `columns.tsx`
2. Import `ProjectDetailSheet`
3. Add `selectedProject` + `isSheetOpen` state
4. Add `handleRowClick` callback
5. Pass `onRowClick` to `PortfolioProjectsTable`
6. Render `<ProjectDetailSheet>` at the bottom of the view

- [ ] **Step 1: Read the file**

Read `src/features/showroom/ui/views/portfolio-projects-view.tsx` (already done in context).

- [ ] **Step 2: Apply changes**

The existing file has this `@/features/showroom` import at line 11:
```typescript
import { PortfolioProjectsTable } from '@/features/showroom/ui/components/table'
```

Replace that single line with these three (alphabetically sorted — `perfectionist/sort-imports` requires this order):
```typescript
import type { ProjectRow } from '@/features/showroom/ui/components/table/columns'
import { ProjectDetailSheet } from '@/features/showroom/ui/components/project-detail-sheet'
import { PortfolioProjectsTable } from '@/features/showroom/ui/components/table'
```

Add state after existing `useState` declarations:
```typescript
const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null)
const [isSheetOpen, setIsSheetOpen] = useState(false)
```

Add callback (place near other `useCallback` declarations):
```typescript
const handleRowClick = useCallback((project: ProjectRow) => {
  setSelectedProject(project)
  setIsSheetOpen(true)
}, [])
```

Update `PortfolioProjectsTable` call — add `onRowClick`:
```typescript
<PortfolioProjectsTable
  data={enrichedProjects}
  tradeFilter={tradeFilter}
  onFilteredCountChange={handleFilteredCountChange}
  onRowClick={handleRowClick}
/>
```

The view already has access to the `deleteProject` mutation from `useProjectActions()` inside `PortfolioProjectsTable`. Lift the mutation to the view by importing and calling it directly:

```typescript
import { useProjectActions } from '@/features/showroom/hooks/use-project-actions'
```

Add inside the component (near other hooks):
```typescript
const { deleteProject } = useProjectActions()
```

Add `ProjectDetailSheet` before the closing `</motion.div>` tag — pass `onDelete` wired to the existing mutation:
```typescript
<ProjectDetailSheet
  project={selectedProject}
  isOpen={isSheetOpen}
  close={() => setIsSheetOpen(false)}
  onDelete={selectedProject
    ? () => deleteProject.mutate({ id: selectedProject.id })
    : undefined}
/>
```

**Note:** `useProjectActions` is also called inside `PortfolioProjectsTable`. Two calls to the same mutation hook creates two independent mutation instances — this is fine for our use case (both target the same endpoint and will each trigger their own loading/error state).

- [ ] **Step 3: Verify lint + types**

```bash
pnpm lint src/features/showroom/ui/views/portfolio-projects-view.tsx
```
Expected: 0 errors.

- [ ] **Step 4: Verify full build compiles**

```bash
pnpm build
```
Expected: successful compilation, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/showroom/ui/views/portfolio-projects-view.tsx
git commit -m "feat(showroom): wire ProjectDetailSheet into portfolio projects view"
```

---

## Fix 2: Footer Height & Cleanup

---

### Task 6: Replace hardcoded URLs in `footer.ts` with ROOTS calls

**Files:**
- Modify: `src/shared/constants/footer.ts`

**Current state:** Plain string URLs, no imports.

**Target state:** Import `ROOTS` and use `ROOTS.landing.*()` for all nav links.

Note on "Custom Home Construction": No `/services/custom-homes` route exists. Use `ROOTS.landing.servicesPillar('energy-efficient-construction')` as the closest match per spec.

> ⚠️ **Route existence:** `ROOTS.landing.servicesPillar` accepts any `string` slug — TypeScript cannot catch invalid slugs. The slugs `'commercial'` and `'design-build'` may or may not have live pages in the app. Verify these routes work after implementing and check the spec with the team if they 404. This does not affect build/lint.

- [ ] **Step 1: Read the file**

Read `src/shared/constants/footer.ts` (already done in context).

- [ ] **Step 2: Rewrite the file**

```typescript
import { ROOTS } from '@/shared/config/roots'

export const footerData = [
  {
    title: 'Services',
    links: [
      { name: 'Custom Home Construction', href: ROOTS.landing.servicesPillar('energy-efficient-construction') },
      { name: 'Luxury Renovations', href: ROOTS.landing.servicesPillar('luxury-renovations') },
      { name: 'Commercial Projects', href: ROOTS.landing.servicesPillar('commercial') },
      { name: 'Design-Build Services', href: ROOTS.landing.servicesPillar('design-build') },
    ],
  },
  {
    title: 'Company',
    links: [
      { name: 'About Us', href: ROOTS.landing.about() },
      { name: 'Tri Pros Experience', href: ROOTS.landing.experience() },
      { name: 'Projects', href: ROOTS.landing.portfolioProjects() },
      { name: 'Testimonials', href: ROOTS.landing.portfolioTestimonials() },
    ],
  },
  {
    title: 'Resources',
    links: [
      { name: 'Contact Us', href: ROOTS.landing.contact() },
      { name: 'Careers', href: ROOTS.landing.communityJoin() },
    ],
  },
]
```

- [ ] **Step 3: Verify lint + types**

```bash
pnpm lint src/shared/constants/footer.ts
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/shared/constants/footer.ts
git commit -m "fix(footer): replace hardcoded URLs with ROOTS.landing calls"
```

---

### Task 7: Condense footer — remove newsletter, fix spacing, fix typo

**Files:**
- Modify: `src/shared/components/footer.tsx`

**Three changes, applied in order:**

**A.** Remove the "Stay Updated" newsletter `<motion.div>` block (lines 118–134).
**B.** Fix spacing per the spec table.
**C.** Fix "rights rights reserved" typo (line 147–148).

- [ ] **Step 1: Read the file**

Read `src/shared/components/footer.tsx` (already done in context).

- [ ] **Step 2: Remove newsletter section**

Delete the entire block from `{/* Newsletter Signup */}` through the closing `</motion.div>` (lines 118–134):
```tsx
        {/* Newsletter Signup */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-12 pt-8 border-t border-primary-foreground/20"
        >
          <div className="max-w-md">
            <h3 className=" font-bold text-lg text-foreground mb-4">
              Stay Updated
            </h3>
            <p className="text-foreground text-sm mb-4">
              Get the latest construction tips, project showcases, and company
              news.
            </p>
          </div>
        </motion.div>
```

- [ ] **Step 3: Condense spacing**

Apply these substitutions (exact string replacements):

Apply these exact string replacements one at a time using the Edit tool:

**1. Container padding:**
- Find: `<div className="container pt-16 pb-12">`
- Replace: `<div className="container pt-8 pb-6">`

**2. Grid gap:**
- Find: `gap-8 lg:gap-12`
- Replace: `gap-6 lg:gap-8`

**3. Nav link list spacing:**
- Find: `<ul className="space-y-3">`
- Replace: `<ul className="space-y-2">`

**4. Nav section heading margin** (inside `footerData.map` block, line ~64):
- Find: `<h3 className=" font-bold text-lg text-foreground mb-4">`
- Replace: `<h3 className=" font-bold text-lg text-foreground mb-3">`

**5. Contact section heading margin** — actual class in the file is `mb-6` (NOT `mb-4` — the spec table listed both but the file uses `mb-6` for Contact):
- Find: `<h3 className=" font-bold text-lg text-foreground mb-6">` (line ~90, the Contact Information heading)
- Replace: `<h3 className=" font-bold text-lg text-foreground mb-3">`

**6. Contact section top margin:**
- Find: `className="mt-12 pt-8 border-t`
- Replace: `className="mt-6 pt-6 border-t`

**7. Bottom bar padding:**
- Find: `<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">`
- Replace: `<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">`

**Note:** Don't search-replace all `mb-4` globally — the nav heading and contact heading have different classes. Apply step 4 (nav section) and step 5 (contact section) as separate edits targeting the specific surrounding context.

- [ ] **Step 4: Fix copyright typo**

Find:
```tsx
              rights reserved.
```
... in context (the full text is `. All rights\n              rights reserved.`). Replace to:
```tsx
              rights reserved.
```
Actually, the full content to find and replace is:
```tsx
            . All rights
            rights reserved.
```
Replace with:
```tsx
            . All rights reserved.
```

- [ ] **Step 5: Verify lint + types**

```bash
pnpm lint src/shared/components/footer.tsx
```
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/shared/components/footer.tsx
git commit -m "fix(footer): remove newsletter section, condense spacing, fix copyright typo"
```

---

## Final Verification

### Task 8: Full project validation

- [ ] **Step 1: Run lint on all changed files**

```bash
pnpm lint
```
Expected: 0 errors across all files.

- [ ] **Step 2: Run full build**

```bash
pnpm build
```
Expected: Successful build. No TypeScript errors.

- [ ] **Step 3: Manual testing checklist**

Verify each item against the spec's testing checklist:

**Showroom Mobile Sheet:**
- [ ] Navigate to `/dashboard?step=showroom` on a mobile viewport (375px)
- [ ] Tap a project row → detail sheet slides in from right
- [ ] Sheet shows: project title, city/state as subtitle, Status badge, Completion date (if any), Trade name badges
- [ ] "Edit Project" button navigates to edit view (closes sheet first)
- [ ] "View on Site" button is only visible for public projects; opens `/portfolio/projects/[accessor]` in new tab
- [ ] Sheet close (X button) dismisses the sheet
- [ ] Desktop: hover on a row still reveals action buttons (regression test)
- [ ] Desktop: clicking a row opens the sheet

**Footer:**
- [ ] "Stay Updated" / newsletter section is gone
- [ ] Copyright line reads "All rights reserved." (no duplicate "rights")
- [ ] All nav links resolve correctly (no 404s on Services, Company, Resources links)
- [ ] Footer is visibly shorter (~350px desktop vs prior ~600px)
- [ ] Footer is fully visible on a 768px-height screen without scrolling past other content
- [ ] Mobile layout is still clean

- [ ] **Step 4: Commit any final cleanup if needed**

```bash
git add -p  # stage only intentional changes
git commit -m "chore: final cleanup after P1 mobile gaps implementation"
```

---

## Summary of All Commits

Expected commit sequence:
1. `feat(shared): add BaseSheet contract component mirroring BaseModal`
2. `feat(showroom): add ProjectDetailSheet for mobile project management`
3. `feat(showroom): export ProjectRow, add activeRowId to meta, add isActive reveal`
4. `feat(showroom): expose onRowClick prop on PortfolioProjectsTable`
5. `feat(showroom): wire ProjectDetailSheet into portfolio projects view`
6. `fix(footer): replace hardcoded URLs with ROOTS.landing calls`
7. `fix(footer): remove newsletter section, condense spacing, fix copyright typo`
