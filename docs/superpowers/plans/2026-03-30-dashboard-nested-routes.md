# Dashboard Nested Routes Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the dashboard from a single `DashboardHub` component with `?step=` query-param routing to proper Next.js nested routes under `/dashboard/`.

**Architecture:** Each dashboard section becomes its own route folder under `src/app/(frontend)/dashboard/`. The sidebar navigates via `<Link href>` + `usePathname()` instead of `setStep()` + `useQueryState()`. A `template.tsx` using motion/react provides fade-in transitions between routes.

**Tech Stack:** Next.js App Router, motion/react, nuqs (removed from dashboard-level routing), ROOTS config for URL generation

**Spec:** `docs/superpowers/specs/2026-03-30-dashboard-nested-routes-design.md`

---

### Task 1: Expand `roots.ts` dashboard namespace

**Files:**
- Modify: `src/shared/config/roots.ts`

- [ ] **Step 1: Update `roots.ts` with full dashboard route tree**

Replace the current `dashboard` object in `APP_ROOTS`:

```ts
// BEFORE (lines 19-23):
dashboard: {
  root: '/dashboard',
  proposalFlow: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/proposals', options),
  meetings: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/meetings', options),
},

// AFTER:
dashboard: {
  root: '/dashboard',
  pipelines: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/pipelines', options),
  meetings: {
    root: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/meetings', options),
    byId: (id: string, options?: Parameters<typeof generateUrl>[1]) => generateUrl(`/dashboard/meetings/${id}`, options),
  },
  proposals: {
    root: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/proposals', options),
    new: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/proposals/new', options),
    byId: (id: string, options?: Parameters<typeof generateUrl>[1]) => generateUrl(`/dashboard/proposals/${id}`, options),
  },
  showroom: {
    root: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/showroom', options),
    new: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/showroom/new', options),
    byId: (id: string, options?: Parameters<typeof generateUrl>[1]) => generateUrl(`/dashboard/showroom/${id}`, options),
  },
  settings: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/settings', options),
  intake: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/intake', options),
  team: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/team', options),
  analytics: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/analytics', options),
},
```

- [ ] **Step 2: Fix any existing references to old dashboard root properties**

The old `ROOTS.dashboard.proposalFlow` and `ROOTS.dashboard.meetings` are being replaced. Search for all usages:

```bash
grep -rn "ROOTS\.dashboard\." src/ --include="*.ts" --include="*.tsx"
```

Update any references:
- `ROOTS.dashboard.proposalFlow(...)` → `ROOTS.dashboard.proposals.root(...)`
- `ROOTS.dashboard.meetings(...)` → `ROOTS.dashboard.meetings.root(...)`

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: No errors related to `ROOTS.dashboard`.

- [ ] **Step 4: Commit**

```bash
git add src/shared/config/roots.ts
# Also add any files updated in Step 2
git commit -m "refactor(config): expand roots.ts dashboard namespace for nested routes"
```

---

### Task 2: Refactor sidebar navigation to use `href` + `pathname`

**Files:**
- Modify: `src/features/agent-dashboard/lib/get-sidebar-nav.ts`
- Modify: `src/features/agent-dashboard/ui/components/app-sidebar.tsx`

- [ ] **Step 1: Refactor `get-sidebar-nav.ts` — replace `step` with `href`**

Replace the entire file content:

```ts
import type { LucideIcon } from 'lucide-react'

import type { AppAbility } from '@/shared/permissions/types'

import {
  BarChart3Icon,
  CalendarIcon,
  ClipboardListIcon,
  FileTextIcon,
  GitBranchIcon,
  ImageIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  UsersIcon,
} from 'lucide-react'

import { ROOTS } from '@/shared/config/roots'

export interface SidebarNavItem {
  href: string
  icon: LucideIcon
  label: string
  enabled: boolean
}

export interface SidebarNavConfig {
  baseItems: readonly SidebarNavItem[]
  adminItems: readonly SidebarNavItem[]
  footerItems: readonly SidebarNavItem[]
}

export function getSidebarNav(ability: AppAbility): SidebarNavConfig {
  const baseItems: SidebarNavItem[] = [
    { href: ROOTS.dashboard.root, icon: LayoutDashboardIcon, label: 'Dashboard', enabled: false },
    { href: ROOTS.dashboard.pipelines(), icon: GitBranchIcon, label: 'Pipelines', enabled: ability.can('read', 'Customer') },
    { href: ROOTS.dashboard.meetings.root(), icon: CalendarIcon, label: 'Meetings', enabled: ability.can('read', 'Meeting') },
    { href: ROOTS.dashboard.proposals.root(), icon: FileTextIcon, label: 'Proposals', enabled: ability.can('read', 'Proposal') },
    { href: ROOTS.dashboard.showroom.root(), icon: ImageIcon, label: 'Showroom', enabled: ability.can('read', 'Project') },
  ]

  const adminItems: SidebarNavItem[] = ability.can('manage', 'all')
    ? [
        { href: ROOTS.dashboard.intake(), icon: ClipboardListIcon, label: 'Intake Form', enabled: false },
        { href: ROOTS.dashboard.team(), icon: UsersIcon, label: 'Team', enabled: false },
        { href: ROOTS.dashboard.analytics(), icon: BarChart3Icon, label: 'Analytics', enabled: false },
      ]
    : []

  const footerItems: SidebarNavItem[] = [
    { href: ROOTS.dashboard.settings(), icon: SettingsIcon, label: 'Settings', enabled: true },
  ]

  return { baseItems, adminItems, footerItems }
}
```

- [ ] **Step 2: Refactor `app-sidebar.tsx` — use `pathname` + `<Link>` for navigation**

Key changes to `app-sidebar.tsx`:

1. Remove imports: `useQueryState`, `nuqs`, `dashboardStepParser` from `@/features/agent-dashboard/lib/url-parsers`
2. Add imports: `usePathname`, `useRouter` from `next/navigation`
3. Add import: `ROOTS` from `@/shared/config/roots`
4. Replace `const [step, setStep] = useQueryState('step', dashboardStepParser)` with:
   ```ts
   const pathname = usePathname()
   const router = useRouter()
   ```
5. Replace `handleNavClick` function — no longer needed (Link handles navigation)
6. Compute active state using pathname:
   ```ts
   // For the dashboard root, use exact match; for all others, use startsWith
   const isActive = item.href === ROOTS.dashboard.root
     ? pathname === item.href
     : pathname.startsWith(item.href)
   ```
7. Replace `SidebarMenuButton` `onClick` pattern with `<Link>` wrapper:
   ```tsx
   <SidebarMenuItem key={item.href}>
     <SidebarMenuButton
       asChild
       data-nav-item
       tooltip={item.label}
       isActive={isActive}
       disabled={!item.enabled}
       className="gap-4 transition-all duration-200 hover:bg-transparent data-[active=true]:bg-transparent"
       style={isActive ? SIDEBAR_NAV_ACTIVE_STYLE : undefined}
     >
       <Link href={item.href}>
         <item.icon className={`size-4 shrink-0 transition-colors duration-200 ${isActive ? 'text-primary' : ''}`} />
         <span>{item.label}</span>
       </Link>
     </SidebarMenuButton>
   </SidebarMenuItem>
   ```
   Note: `asChild` on `SidebarMenuButton` lets the `<Link>` be the actual rendered element.
   For disabled items, keep the `SidebarMenuButton` without `asChild` and without `<Link>`.
8. Update `SidebarUserButton.onSettingsClick` from `() => setStep('settings')` to `() => router.push(ROOTS.dashboard.settings())`
9. Sidebar mobile: remove `setOpenMobile(false)` from `handleNavClick` — `<Link>` navigation naturally closes the mobile sheet since the page changes.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: May show errors for other files still importing `dashboardStepParser` — those are addressed in Tasks 4-5.

- [ ] **Step 4: Commit**

```bash
git add src/features/agent-dashboard/lib/get-sidebar-nav.ts src/features/agent-dashboard/ui/components/app-sidebar.tsx
git commit -m "refactor(sidebar): migrate from step query-param to pathname-based navigation"
```

---

### Task 3: Create route pages + `template.tsx`

**Files:**
- Create: `src/app/(frontend)/dashboard/template.tsx`
- Modify: `src/app/(frontend)/dashboard/page.tsx`
- Create: `src/app/(frontend)/dashboard/pipelines/page.tsx`
- Create: `src/app/(frontend)/dashboard/meetings/page.tsx`
- Create: `src/app/(frontend)/dashboard/proposals/page.tsx`
- Create: `src/app/(frontend)/dashboard/proposals/new/page.tsx`
- Create: `src/app/(frontend)/dashboard/proposals/[proposalId]/page.tsx`
- Create: `src/app/(frontend)/dashboard/showroom/page.tsx`
- Create: `src/app/(frontend)/dashboard/showroom/new/page.tsx`
- Create: `src/app/(frontend)/dashboard/showroom/[projectId]/page.tsx`
- Create: `src/app/(frontend)/dashboard/settings/page.tsx`
- Create: `src/app/(frontend)/dashboard/intake/page.tsx`
- Create: `src/app/(frontend)/dashboard/team/page.tsx`
- Create: `src/app/(frontend)/dashboard/analytics/page.tsx`

- [ ] **Step 1: Create `template.tsx` for route transitions**

Create `src/app/(frontend)/dashboard/template.tsx`:

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

- [ ] **Step 2: Rewrite `dashboard/page.tsx` — dashboard overview (coming soon)**

Replace `src/app/(frontend)/dashboard/page.tsx`:

```tsx
import { EmptyState } from '@/shared/components/states/empty-state'
import { protectDashboardPage } from '@/shared/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function DashboardOverviewPage() {
  await protectDashboardPage()
  return <EmptyState title="Coming Soon" description="The dashboard overview is under construction." />
}
```

- [ ] **Step 3: Create `pipelines/page.tsx`**

Create `src/app/(frontend)/dashboard/pipelines/page.tsx`:

```tsx
import { CustomerPipelineView } from '@/features/customer-pipelines/ui/views'
import { protectDashboardPage } from '@/shared/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function PipelinesPage() {
  await protectDashboardPage()
  return <CustomerPipelineView />
}
```

- [ ] **Step 4: Create `meetings/page.tsx`**

Create `src/app/(frontend)/dashboard/meetings/page.tsx`:

```tsx
import { MeetingsView } from '@/features/meetings/ui/views'
import { protectDashboardPage } from '@/shared/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function MeetingsPage() {
  await protectDashboardPage()
  return <MeetingsView />
}
```

- [ ] **Step 5: Create `proposals/page.tsx`**

Create `src/app/(frontend)/dashboard/proposals/page.tsx`:

```tsx
import { PastProposalsView } from '@/features/proposal-flow/ui/views'
import { protectDashboardPage } from '@/shared/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function ProposalsPage() {
  await protectDashboardPage()
  return <PastProposalsView />
}
```

- [ ] **Step 6: Create `proposals/new/page.tsx`**

Create `src/app/(frontend)/dashboard/proposals/new/page.tsx`:

```tsx
import { CreateNewProposalView } from '@/features/proposal-flow/ui/views'
import { protectDashboardPage } from '@/shared/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function NewProposalPage() {
  await protectDashboardPage()
  return <CreateNewProposalView />
}
```

- [ ] **Step 7: Create `proposals/[proposalId]/page.tsx`**

Create `src/app/(frontend)/dashboard/proposals/[proposalId]/page.tsx`:

`EditProposalView` currently reads `proposalId` from `useQueryState('proposalId')`. It needs to be updated to accept `proposalId` as a prop instead. That change happens in Task 5. For now, create the page wrapper:

```tsx
import { EditProposalView } from '@/features/proposal-flow/ui/views'
import { protectDashboardPage } from '@/shared/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function EditProposalPage({ params }: { params: Promise<{ proposalId: string }> }) {
  await protectDashboardPage()
  const { proposalId } = await params
  return <EditProposalView proposalId={proposalId} />
}
```

- [ ] **Step 8: Create `showroom/page.tsx`**

Create `src/app/(frontend)/dashboard/showroom/page.tsx`:

```tsx
import { PortfolioProjectsView } from '@/features/showroom/ui/views'
import { protectDashboardPage } from '@/shared/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function ShowroomPage() {
  await protectDashboardPage()
  return <PortfolioProjectsView />
}
```

- [ ] **Step 9: Create `showroom/new/page.tsx`**

Create `src/app/(frontend)/dashboard/showroom/new/page.tsx`:

```tsx
import { CreateProjectView } from '@/features/showroom/ui/views'
import { protectDashboardPage } from '@/shared/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function NewProjectPage() {
  await protectDashboardPage()
  return <CreateProjectView />
}
```

- [ ] **Step 10: Create `showroom/[projectId]/page.tsx`**

Create `src/app/(frontend)/dashboard/showroom/[projectId]/page.tsx`:

`EditProjectView` already accepts `projectId` as a prop — just pass the route param:

```tsx
import { EditProjectView } from '@/features/showroom/ui/views'
import { protectDashboardPage } from '@/shared/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function EditProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  await protectDashboardPage()
  const { projectId } = await params
  return <EditProjectView projectId={projectId} />
}
```

- [ ] **Step 11: Create `settings/page.tsx`**

Create `src/app/(frontend)/dashboard/settings/page.tsx`:

```tsx
import { SettingsView } from '@/features/agent-settings/ui/views/settings-view'
import { protectDashboardPage } from '@/shared/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  await protectDashboardPage()
  return <SettingsView />
}
```

- [ ] **Step 12: Create coming-soon pages (intake, team, analytics)**

Create `src/app/(frontend)/dashboard/intake/page.tsx`:

```tsx
import { EmptyState } from '@/shared/components/states/empty-state'
import { protectDashboardPage } from '@/shared/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function IntakePage() {
  await protectDashboardPage()
  return <EmptyState title="Coming Soon" description="The intake form is under construction." />
}
```

Create `src/app/(frontend)/dashboard/team/page.tsx`:

```tsx
import { EmptyState } from '@/shared/components/states/empty-state'
import { protectDashboardPage } from '@/shared/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  await protectDashboardPage()
  return <EmptyState title="Coming Soon" description="Team management is under construction." />
}
```

Create `src/app/(frontend)/dashboard/analytics/page.tsx`:

```tsx
import { EmptyState } from '@/shared/components/states/empty-state'
import { protectDashboardPage } from '@/shared/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  await protectDashboardPage()
  return <EmptyState title="Coming Soon" description="Analytics is under construction." />
}
```

- [ ] **Step 13: Commit**

```bash
git add src/app/\(frontend\)/dashboard/
git commit -m "refactor(dashboard): create nested route pages with template transition"
```

---

### Task 4: Update showroom views — replace `setStep` with `useRouter` + `ROOTS`

**Files:**
- Modify: `src/features/showroom/ui/views/portfolio-projects-view.tsx`
- Modify: `src/features/showroom/ui/views/create-project-view.tsx`
- Modify: `src/features/showroom/ui/views/edit-project-view.tsx`

- [ ] **Step 1: Update `portfolio-projects-view.tsx`**

1. Remove import: `import { useQueryState } from 'nuqs'`
2. Remove import: `import { dashboardStepParser } from '@/features/agent-dashboard/lib'`
3. Add import: `import { useRouter } from 'next/navigation'`
4. Add import: `import { ROOTS } from '@/shared/config/roots'`
5. Replace `const [, setStep] = useQueryState('step', dashboardStepParser)` with `const router = useRouter()`
6. Replace `onClick={() => setStep('create-project')}` (line 137) with `onClick={() => router.push(ROOTS.dashboard.showroom.new())}`

- [ ] **Step 2: Update `create-project-view.tsx`**

1. Remove import: `import { useQueryState } from 'nuqs'`
2. Remove import: `import { dashboardStepParser } from '@/features/agent-dashboard/lib'`
3. Add import: `import { useRouter } from 'next/navigation'`
4. Add import: `import { ROOTS } from '@/shared/config/roots'`
5. Replace `const [, setStep] = useQueryState('step', dashboardStepParser)` with `const router = useRouter()`
6. Replace `setStep('showroom')` in `onSuccess` (line 34) with `router.push(ROOTS.dashboard.showroom.root())`
7. Replace `onClick={() => setStep('showroom')}` (line 55) with `onClick={() => router.push(ROOTS.dashboard.showroom.root())}`

- [ ] **Step 3: Update `edit-project-view.tsx`**

1. Remove import: `import { useQueryState } from 'nuqs'`
2. Remove import: `import { dashboardStepParser } from '@/features/agent-dashboard/lib'`
3. Add import: `import { useRouter } from 'next/navigation'`
4. Replace `const [, setStep] = useQueryState('step', dashboardStepParser)` with `const router = useRouter()`
   Note: `ROOTS` is already imported in this file.
5. Replace `onClick={() => setStep('showroom')}` (line 127) with `onClick={() => router.push(ROOTS.dashboard.showroom.root())}`

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add src/features/showroom/ui/views/portfolio-projects-view.tsx src/features/showroom/ui/views/create-project-view.tsx src/features/showroom/ui/views/edit-project-view.tsx
git commit -m "refactor(showroom): replace setStep with router.push + ROOTS for navigation"
```

---

### Task 5: Update proposal + settings views — replace `setStep` / query-param ID reading

**Files:**
- Modify: `src/features/proposal-flow/ui/views/edit-proposal-view.tsx`
- Modify: `src/features/agent-settings/ui/views/settings-view.tsx`
- Modify: `src/features/agent-settings/ui/components/admin-section.tsx`

- [ ] **Step 1: Update `edit-proposal-view.tsx` — accept `proposalId` as prop**

Currently reads `proposalId` from `useQueryState('proposalId')`. Change to accept it as a prop:

1. Add prop interface and update function signature:
   ```tsx
   interface EditProposalViewProps {
     proposalId: string
   }

   export function EditProposalView({ proposalId }: EditProposalViewProps) {
   ```
2. Remove: `const [proposalId] = useQueryState('proposalId')` (line 26)
3. Remove: `import { useQueryState } from 'nuqs'` (line 7) — only if no other `useQueryState` calls remain in the file (check: `meetingId` is read by `CreateNewProposalView`, not this file, so this import can be removed)
4. Update all usages of `proposalId!` to just `proposalId` (no longer nullable):
   - Line 28: `const proposal = useGetProposal(proposalId, undefined)` (remove `!` and `{ enabled: !!proposalId }`)
   - Line 73: remove the `if (!proposalId) return` guard
   - Lines 99 and 130-131: `proposalId` is already used without `!` in JSX, no change needed

- [ ] **Step 2: Update `settings-view.tsx` — replace `setStep` with `useRouter` + `ROOTS`**

1. Remove import: `import { useQueryState } from 'nuqs'`
2. Remove import: `import { dashboardStepParser } from '@/features/agent-dashboard/lib/url-parsers'`
3. Add import: `import { useRouter } from 'next/navigation'`
4. Add import: `import { ROOTS } from '@/shared/config/roots'`
5. Replace `const [, setStep] = useQueryState('step', dashboardStepParser)` with `const router = useRouter()`
6. Replace `handleNavigate` function:
   ```ts
   function handleNavigate(path: string) {
     router.push(path)
   }
   ```
7. Note: `AdminSection` calls `onNavigate('intake')` / `onNavigate('team')` — needs updating too.

- [ ] **Step 3: Update `admin-section.tsx` — use ROOTS paths**

1. Add import: `import { ROOTS } from '@/shared/config/roots'`
2. Update the `onNavigate` prop type and calls:
   ```tsx
   interface AdminSectionProps {
     onNavigate: (path: string) => void
   }
   ```
   The type stays the same (`string`), but update the call sites:
   - `onClick={() => onNavigate('intake')}` → `onClick={() => onNavigate(ROOTS.dashboard.intake())}`
   - `onClick={() => onNavigate('team')}` → `onClick={() => onNavigate(ROOTS.dashboard.team())}`

- [ ] **Step 4: Update `proposal-flow/ui/views/index.ts` barrel export**

Check if the barrel re-exports `EditProposalView`. If it does, no change needed — the component name is the same, just the props changed.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6: Commit**

```bash
git add src/features/proposal-flow/ui/views/edit-proposal-view.tsx src/features/agent-settings/ui/views/settings-view.tsx src/features/agent-settings/ui/components/admin-section.tsx
git commit -m "refactor(proposals,settings): replace query-param patterns with route params and ROOTS"
```

---

### Task 6: Delete old hub infrastructure + clean up barrel exports

**Files:**
- Delete: `src/features/agent-dashboard/ui/views/dashboard-hub.tsx`
- Delete: `src/features/agent-dashboard/lib/url-parsers.ts`
- Delete: `src/features/agent-dashboard/constants/dashboard-steps.ts`
- Delete: `src/features/agent-dashboard/types/index.ts`
- Modify: `src/features/agent-dashboard/lib/index.ts`
- Check: `src/shared/lib/url-parsers.ts` (editProjectIdParser)

- [ ] **Step 1: Delete `dashboard-hub.tsx`**

```bash
rm src/features/agent-dashboard/ui/views/dashboard-hub.tsx
```

- [ ] **Step 2: Delete `url-parsers.ts` (agent-dashboard)**

```bash
rm src/features/agent-dashboard/lib/url-parsers.ts
```

- [ ] **Step 3: Delete `dashboard-steps.ts`**

```bash
rm src/features/agent-dashboard/constants/dashboard-steps.ts
```

- [ ] **Step 4: Delete `types/index.ts`**

```bash
rm src/features/agent-dashboard/types/index.ts
```

If the `types/` directory is now empty, remove it:

```bash
rmdir src/features/agent-dashboard/types/ 2>/dev/null
```

- [ ] **Step 5: Update `lib/index.ts` barrel**

The current content is:
```ts
export { dashboardStepParser } from './url-parsers'
```

Check if `get-sidebar-nav.ts` or other files in `lib/` need re-exporting. If `lib/index.ts` has nothing left to export, either delete it or update it to export what remains:

```bash
ls src/features/agent-dashboard/lib/
```

Expected files: `get-sidebar-nav.ts`, `index.ts`. Update `index.ts`:

```ts
export { getSidebarNav } from './get-sidebar-nav'
export type { SidebarNavConfig, SidebarNavItem } from './get-sidebar-nav'
```

Or if nothing else imports from `@/features/agent-dashboard/lib` via barrel, delete `index.ts`.

- [ ] **Step 6: Check `editProjectIdParser` in `src/shared/lib/url-parsers.ts`**

The research showed `editProjectIdParser` was only used in `dashboard-hub.tsx` (now deleted). Remove it from `src/shared/lib/url-parsers.ts` if no other file imports it:

```bash
grep -rn "editProjectIdParser" src/ --include="*.ts" --include="*.tsx"
```

If only the definition remains, remove the export from the file.

- [ ] **Step 7: Full grep for any remaining references to deleted items**

```bash
grep -rn "dashboardStepParser\|dashboardSteps\|DashboardStep\|dashboard-hub\|DashboardHub" src/ --include="*.ts" --include="*.tsx"
```

Expected: No results. If any file still references these, update it.

- [ ] **Step 8: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: Clean compile.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(dashboard): delete DashboardHub, step parser, and step constants"
```

---

### Task 7: Final verification — lint, typecheck, and diff review

**Files:** None (verification only)

- [ ] **Step 1: Run lint**

```bash
pnpm lint 2>&1 | tail -20
```

Fix any lint errors (likely import sorting).

- [ ] **Step 2: Run typecheck**

```bash
pnpm tsc --noEmit
```

Expected: Clean.

- [ ] **Step 3: Review full diff**

```bash
git diff main --stat
git diff main
```

Check for:
- No debug logs or leftover code
- No unintended changes
- All `setStep` calls replaced
- All `dashboardStepParser` imports removed
- All new route pages follow the consistent pattern
- `roots.ts` dashboard namespace is complete

- [ ] **Step 4: Final commit (if lint fixes were needed)**

```bash
git add -A
git commit -m "refactor(dashboard): fix lint errors from nested routes migration"
```
