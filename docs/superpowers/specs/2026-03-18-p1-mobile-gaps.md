# P1 Mobile Gaps Fixes — Design Spec

**Date**: 2026-03-18
**Status**: Draft
**Scope**: 2 fixes — showroom projects mobile usability, footer height & cleanup

---

## 1. Overview

Fix two mobile UX gaps: projects in the showroom dashboard lack usable actions on mobile, and the footer is too tall for smaller screens.

### Goals

1. Projects on `/dashboard?step=showroom` are fully manageable on mobile (view, edit, delete)
2. Footer is condensed to ~50% of current height, dead sections removed, all links functional

### Non-Goals

- Redesigning the showroom table for desktop
- Adding newsletter signup functionality (the dead section is just removed)
- Adding social media links to the footer

---

## 2. Fix 1: Showroom Projects Mobile

### Problem

The showroom projects table (`src/features/showroom/ui/components/table/`) renders a wide table that doesn't adapt on mobile. Action buttons are only visible on desktop hover. There is no mobile-friendly way to view, edit, or delete a project.

### Solution

Two parts: a shared `BaseSheet` contract component, then a showroom-specific project detail sheet.

#### Part A: Shared `BaseSheet` Component

**File:** `src/shared/components/dialogs/sheets/base-sheet.tsx`

Create a sheet contract component following the exact `BaseModal` pattern from `src/shared/components/dialogs/modals/base-modal.tsx`.

**Props interface:**
```typescript
interface BaseSheetProps {
  close: () => void
  isOpen: boolean
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
}
```

**Behavior:**
- Default `side`: `'right'`
- Uses existing shadcn Sheet primitives from `@/shared/components/ui/sheet` (`Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription`)
- Close button: included by shadcn's `SheetContent` (built-in X button)
- Mobile: `w-full` full-width
- Desktop: constrained via `className` override (default `sm:max-w-md`)
- Scrollable body: `overflow-y-auto` on the children container
- `description` supports both `string` and `React.ReactNode` (use `asChild` on `SheetDescription` for ReactNode, same pattern as BaseModal)

**Pattern match with BaseModal:**
| Feature | BaseModal | BaseSheet |
|---|---|---|
| Open/close control | `isOpen` + `close` props | Same |
| Title | `React.ReactNode` | Same |
| Description | Optional `React.ReactNode` | Same |
| Children | Free-form body | Same |
| Close button | X icon, top-right | Built into `SheetContent` |
| Mobile | Fullscreen | Full-width from side |
| Desktop | Centered, max-width | Side panel, max-width |
| Styling override | `className` prop | Same |

This component is a shared UI entity — any feature can consume it by passing props and children.

**Naming note:** The existing modal contract is exported as `Modal` (not `BaseModal`) from `base-modal.tsx`. For consistency, export the new sheet as `BaseSheet` from `base-sheet.tsx` — the "Base" prefix matches the filename and distinguishes it from the shadcn `Sheet` primitive.

**`asChild` note:** Both `SheetDescription` and `DialogDescription` are built on `@radix-ui/react-dialog` under the hood (check `sheet.tsx` line 3). The `asChild` pattern works identically for both.

#### Part B: Showroom Project Detail Sheet

**File:** `src/features/showroom/ui/components/project-detail-sheet.tsx`

A feature-specific sheet that consumes `BaseSheet` and displays project details for mobile use.

**Props:**
```typescript
// ProjectRow is the enriched type from the table — NOT ShowroomProject.
// It comes from: inferRouterOutputs<AppRouter>['showroomRouter']['getAllProjects'][number] & { tradeNames: string[] }
// Check src/features/showroom/ui/components/table/index.tsx for the exact type.
interface ProjectDetailSheetProps {
  project: ProjectRow | null
  isOpen: boolean
  close: () => void
}
```

**Important type note:** `onRowClick` on the DataTable receives the table's `TData` — which is `ProjectRow` (the router output enriched with `tradeNames`), NOT `ShowroomProject`. The `ProjectRow` type flattens the project fields differently. Read the actual type in `src/features/showroom/ui/components/table/index.tsx` before implementing.

**Content (when project is non-null):**
- Project title as sheet title
- Location (city, state) as description
- Body sections:
  - **Status badge:** Public / Draft
  - **Completion date** (if available)
  - **Trade names** (from `project.tradeNames`)
- **Actions (bottom of sheet):**
  - "Edit Project" button → navigates to edit view
  - "View on Site" button → opens `/portfolio/projects/[accessor]` (if public)
  - "Delete Project" button → triggers delete (destructive, uses `variant="destructive"`)

#### Part C: Wire Into Showroom View

**Modify:** `src/features/showroom/ui/views/portfolio-projects-view.tsx`

1. Add state: `selectedProject` (ProjectRow | null), `isSheetOpen` (boolean)
2. Pass `onRowClick` to the DataTable: on click, set `selectedProject` and open sheet
3. Render `ProjectDetailSheet` at the bottom of the view

**Modify:** `src/features/showroom/ui/components/table/columns.tsx`

First, add `activeRowId: string | null` to the `ProjectTableMeta` interface (check `columns.tsx` around line 19-22 for the existing interface). The DataTable injects this value at runtime, but TypeScript needs it declared in the meta type for safe access.

Then add the `isActive` conditional to the action button container (same pattern as meetings columns):

```typescript
const isActive = meta?.activeRowId === row.original.project.id

<div className={cn(
  'flex items-center gap-1 shrink-0 opacity-0 pointer-events-none',
  'group-hover:opacity-100 group-hover:pointer-events-auto',
  isActive && 'opacity-100 pointer-events-auto',
)}>
  {/* existing action buttons */}
</div>
```

This gives tap-to-reveal on mobile as a fallback even without the sheet, and the sheet provides the full detail experience.

### Files

- Create: `src/shared/components/dialogs/sheets/base-sheet.tsx`
- Create: `src/features/showroom/ui/components/project-detail-sheet.tsx`
- Modify: `src/features/showroom/ui/components/table/columns.tsx`
- Modify: `src/features/showroom/ui/views/portfolio-projects-view.tsx`

---

## 3. Fix 2: Footer Height & Cleanup

### Problem

The footer (`src/shared/components/footer.tsx`) is ~600px+ tall on desktop. It gets partially hidden behind the previous section on smaller laptop screens. The "Stay Updated" newsletter section is dead (no form, no inputs, no functionality).

### Solution

#### A. Remove dead sections

Delete the entire "Stay Updated" / newsletter section. It has no form, no input, no submit handler — purely placeholder HTML.

#### B. Condense spacing

| Property | Current | New |
|---|---|---|
| Footer container `pt` | `pt-16` (64px) | `pt-8` (32px) |
| Footer container `pb` | `pb-12` (48px) | `pb-6` (24px) |
| Grid gap | `gap-8 lg:gap-12` | `gap-6 lg:gap-8` |
| Link list spacing | `space-y-3` | `space-y-2` |
| Section heading margin | `mb-4` / `mb-6` | `mb-3` |
| Contact section top margin | `mt-12 pt-8` | `mt-6 pt-6` |
| Bottom bar padding | `py-6` | `py-4` |

#### C. Fix bugs

1. **Duplicate "rights reserved"** — Line 148 has "rights rights reserved". Fix to "rights reserved."
2. **Hardcoded URLs** — Footer links in `src/shared/constants/footer.ts` use hardcoded strings (some pointing to wrong routes like `/services/renovations`). Replace all with `ROOTS.landing.*()` calls:

| Current footer URL | Replace with |
|---|---|
| `/services/custom-homes` | `ROOTS.landing.servicesPillar('energy-efficient-construction')` (closest match — or remove if no "custom homes" route) |
| `/services/renovations` | `ROOTS.landing.servicesPillar('luxury-renovations')` |
| `/services/commercial` | `ROOTS.landing.servicesPillar('commercial')` |
| `/services/design-build` | `ROOTS.landing.servicesPillar('design-build')` |
| `/about` | `ROOTS.landing.about()` |
| `/experience` | `ROOTS.landing.experience()` |
| `/portfolio/projects` | `ROOTS.landing.portfolioProjects()` |
| `/portfolio/testimonials` | `ROOTS.landing.portfolioTestimonials()` |
| `/contact` | `ROOTS.landing.contact()` |
| `/community/join` | `ROOTS.landing.communityJoin()` |

Also update any hardcoded URLs in `footer.tsx` itself (e.g. `/privacy`, `/sitemap.xml` — these can stay hardcoded since they're not in ROOTS and are unlikely to change).

#### D. Keep

- Logo + company description + certifications badge
- Three navigation sections (Services, Company, Resources)
- Contact information grid (address, phone, email, license)
- Bottom legal bar (copyright + Privacy Policy + Sitemap)

#### Target

Reduce footer height from ~600px to ~350px on desktop. Roughly 40-50% reduction.

### Files

- Modify: `src/shared/components/footer.tsx`
- Modify: `src/shared/constants/footer.ts`

---

## 4. Testing Checklist

- [ ] Mobile: Tap a project row in showroom → detail sheet slides in from right
- [ ] Mobile: Sheet shows project title, location, status, actions
- [ ] Mobile: "Edit Project" button in sheet navigates correctly
- [ ] Mobile: Sheet close button works, swipe to dismiss works
- [ ] Desktop: Project table hover-reveal actions still work
- [ ] Desktop: Row click opens sheet (optional — could be edit-only on desktop)
- [ ] Footer: Newsletter section is gone
- [ ] Footer: Copyright line no longer has duplicate "rights"
- [ ] Footer: All links point to correct routes (no `/services/renovations`)
- [ ] Footer: Visually shorter (~350px on desktop)
- [ ] Footer: Fully visible on 768px height screens without scrolling
- [ ] Footer: Mobile layout still clean and usable
- [ ] `pnpm lint` passes
