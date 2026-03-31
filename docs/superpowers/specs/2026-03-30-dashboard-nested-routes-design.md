# Dashboard Nested Routes Migration

**Issue:** #56 — refactor(dashboard): migrate from query-param hub to nested route architecture
**Branch:** `refactor/56-refactor-dashboard-migrate-from-query-pa`
**Date:** 2026-03-30

## Problem

The dashboard routes all views through a single `DashboardHub` component (`src/features/agent-dashboard/ui/views/dashboard-hub.tsx`). Navigation between sections is controlled by a `?step=` nuqs query parameter, and every view is conditionally rendered inside the same page.

This causes:
- **No code-splitting** — all views are imported and bundled together
- **DashboardHub grows proportionally** — every new section adds another switch case
- **URLs aren't semantic** — `/dashboard?step=customer-pipelines` vs `/dashboard/pipelines`
- **Sub-navigation is awkward** — create/edit flows are top-level step values instead of scoped routes

## Decision: Full Route-Based Architecture (Option B)

Every dashboard destination becomes its own Next.js route. No `?step=` at the top level. Create and edit flows get their own routes (`/new`, `/[id]`) rather than query params.

Rationale: `roots.ts` is purely path-based with `generateUrl()`. Option B is the natural fit — every destination is a clean path, no query param logic needed. Consistent active-state detection via `pathname`, full code-splitting per page.

## Route Structure

```
src/app/(frontend)/dashboard/
├── layout.tsx                    ← KEEP (SidebarProvider + AppSidebar + SidebarInset)
├── template.tsx                  ← NEW (motion fade-in transition)
├── page.tsx                      ← REWRITE → EmptyState "Coming Soon"
├── pipelines/
│   └── page.tsx                  ← CustomerPipelineView
├── meetings/
│   ├── page.tsx                  ← MeetingsView (list)
│   └── [meetingId]/
│       └── page.tsx              ← KEEP (already exists)
├── proposals/
│   ├── page.tsx                  ← PastProposalsView (list)
│   ├── new/
│   │   └── page.tsx              ← CreateNewProposalView
│   └── [proposalId]/
│       └── page.tsx              ← EditProposalView
├── showroom/
│   ├── page.tsx                  ← PortfolioProjectsView (list)
│   ├── new/
│   │   └── page.tsx              ← CreateProjectView
│   └── [projectId]/
│       └── page.tsx              ← EditProjectView
├── settings/
│   └── page.tsx                  ← SettingsView
├── intake/
│   └── page.tsx                  ← EmptyState (coming soon)
├── team/
│   └── page.tsx                  ← EmptyState (coming soon)
└── analytics/
    └── page.tsx                  ← EmptyState (coming soon)
```

## `roots.ts` Expansion

The dashboard namespace expands to cover every route. Sections with nested routes get sub-objects:

```ts
dashboard: {
  root: '/dashboard',
  pipelines: (options?) => generateUrl('/dashboard/pipelines', options),
  meetings: {
    root: (options?) => generateUrl('/dashboard/meetings', options),
    byId: (id: string, options?) => generateUrl(`/dashboard/meetings/${id}`, options),
  },
  proposals: {
    root: (options?) => generateUrl('/dashboard/proposals', options),
    new: (options?) => generateUrl('/dashboard/proposals/new', options),
    byId: (id: string, options?) => generateUrl(`/dashboard/proposals/${id}`, options),
  },
  showroom: {
    root: (options?) => generateUrl('/dashboard/showroom', options),
    new: (options?) => generateUrl('/dashboard/showroom/new', options),
    byId: (id: string, options?) => generateUrl(`/dashboard/showroom/${id}`, options),
  },
  settings: (options?) => generateUrl('/dashboard/settings', options),
  intake: (options?) => generateUrl('/dashboard/intake', options),
  team: (options?) => generateUrl('/dashboard/team', options),
  analytics: (options?) => generateUrl('/dashboard/analytics', options),
}
```

Every navigation call in the app uses `ROOTS.dashboard.*` — no hardcoded path strings.

## Sidebar Navigation Refactor

### `SidebarNavItem` interface change

```ts
// Before
interface SidebarNavItem {
  step: DashboardStep
  icon: LucideIcon
  label: string
  enabled: boolean
}

// After
interface SidebarNavItem {
  href: string
  icon: LucideIcon
  label: string
  enabled: boolean
}
```

### `get-sidebar-nav.ts`

Items use `ROOTS.dashboard.*` instead of step strings:

```ts
{ href: ROOTS.dashboard.root, icon: LayoutDashboardIcon, label: 'Dashboard', enabled: false },
{ href: ROOTS.dashboard.pipelines(), icon: GitBranchIcon, label: 'Pipelines', enabled: ... },
{ href: ROOTS.dashboard.meetings.root(), icon: CalendarIcon, label: 'Meetings', enabled: ... },
{ href: ROOTS.dashboard.proposals.root(), icon: FileTextIcon, label: 'Proposals', enabled: ... },
{ href: ROOTS.dashboard.showroom.root(), icon: ImageIcon, label: 'Showroom', enabled: ... },
// admin items
{ href: ROOTS.dashboard.intake(), icon: ClipboardListIcon, label: 'Intake Form', enabled: false },
{ href: ROOTS.dashboard.team(), icon: UsersIcon, label: 'Team', enabled: false },
{ href: ROOTS.dashboard.analytics(), icon: BarChart3Icon, label: 'Analytics', enabled: false },
// footer
{ href: ROOTS.dashboard.settings(), icon: SettingsIcon, label: 'Settings', enabled: true },
```

### `app-sidebar.tsx`

- Remove `useQueryState('step', dashboardStepParser)` and `setStep`
- Add `usePathname()` from `next/navigation`
- Active state: for `ROOTS.dashboard.root` use exact match (`pathname === item.href`); for all others use `pathname.startsWith(item.href)` (so `/dashboard/meetings/abc` highlights "Meetings")
- `SidebarMenuButton` wraps in `<Link href={item.href}>` instead of `onClick={() => setStep(...)}`
- `SidebarUserButton.onSettingsClick` navigates to `ROOTS.dashboard.settings()` via `useRouter().push()`

## Page Component Pattern

Each route page follows the same thin server-component wrapper:

```tsx
import { CustomerPipelineView } from '@/features/customer-pipelines/ui/views'
import { protectDashboardPage } from '@/shared/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function PipelinesPage() {
  await protectDashboardPage()
  return <CustomerPipelineView />
}
```

- Server component with `protectDashboardPage()` for auth gating
- `force-dynamic` since dashboard is always authenticated
- No `authState` prop — layout handles session check, `protectDashboardPage()` redirects on failure

### `editProjectId` query param

Currently `dashboard-hub.tsx` reads `editProjectId` from the URL and passes it to `EditProjectView`. With the new route `/dashboard/showroom/[projectId]`, the ID comes from the route param — no query param needed. Same pattern for `/dashboard/proposals/[proposalId]`.

## Route Transition Animation

`dashboard/template.tsx` — a client component using motion/react for fade-in on every route change. Next.js `template.tsx` remounts on navigation (unlike `layout.tsx`).

```tsx
'use client'

import { motion } from 'motion/react'

export function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="h-full"
    >
      {children}
    </motion.div>
  )
}

export default DashboardTemplate
```

No exit animation — instant unmount + smooth fade-in is standard for dashboard navigation. No experimental APIs required.

## Files Deleted

| File | Reason |
|---|---|
| `features/agent-dashboard/ui/views/dashboard-hub.tsx` | Replaced by individual route pages |
| `features/agent-dashboard/lib/url-parsers.ts` | `dashboardStepParser` no longer used |
| `features/agent-dashboard/constants/dashboard-steps.ts` | Step enum no longer used |
| `features/agent-dashboard/types/` (`DashboardStep` type) | Derived from steps array, no longer needed |

## Files Kept (refactored)

| File | Changes |
|---|---|
| `app-sidebar.tsx` | `pathname` + `<Link>` replaces `step` + `setStep` |
| `get-sidebar-nav.ts` | `href` replaces `step`, uses `ROOTS.dashboard.*` |
| `roots.ts` | Expanded dashboard namespace |
| `dashboard/page.tsx` | Rewritten to EmptyState |

## Files Kept (unchanged)

- `sidebar-styles.ts`
- `mobile-bottom-nav.tsx`
- `action-center-sheet.tsx`
- `sidebar-user-button.tsx`
- `action-center-view.tsx`
- `dashboard/layout.tsx`

## Consumer Updates

Any file importing `DashboardStep`, `dashboardStepParser`, or `dashboardSteps` must be updated. Primary consumer is the sidebar. Full grep during implementation to catch all references.
