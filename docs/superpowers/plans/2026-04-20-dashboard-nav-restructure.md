# Dashboard Nav Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the agent dashboard sidebar into a top-level Dashboard item + `Main` (Pipeline, Schedule) + collapsible `Records` group (Customers disabled, Meetings, Proposals, Projects) while preserving the existing `Admin` and `Footer` sections.

**Architecture:** `getSidebarNav(ability)` returns a self-documenting `SidebarNavConfig` with named fields for each group. `app-sidebar.tsx` renders Dashboard ungrouped, Main and Records as groups, with Records wrapped in a shadcn `Collapsible` (forced open in icon-collapsed sidebar mode). No route changes — renders against existing `/dashboard/meetings`, `/proposals`, `/projects`. Customers nav item is present but `enabled: false` until its page is built in a follow-up.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, shadcn/ui (`Sidebar`, `Collapsible`), Tailwind v4, lucide-react, CASL (`AppAbility`).

**Verification model:** This project has no test infrastructure for UI. Verification per task is `pnpm tsc` + `pnpm lint` + manual browser check via `pnpm dev`. There are no automated tests to write — do not add a test runner as part of this work.

**Project rules (from CLAUDE.md):**
- NEVER run `pnpm build`. Use `pnpm tsc` for type-checking.
- ONE React component per file, named exports only.
- No file-level constants or helpers in component files — extract to `constants/` or `lib/`.
- Prop interfaces stay in the component file unless shared.

---

## File Structure

**Modify:**
- `src/shared/config/roots.ts` — add `dashboard.customers.root`
- `src/features/agent-dashboard/lib/get-sidebar-nav.ts` — new `SidebarNavConfig` shape, new items
- `src/features/agent-dashboard/ui/components/app-sidebar.tsx` — render Dashboard ungrouped + wire up new config + render `<SidebarRecordsGroup>`

**Create:**
- `src/features/agent-dashboard/ui/components/sidebar-records-group.tsx` — collapsible Records group component (its own file to keep `app-sidebar.tsx` focused and respect "one component per file")

---

## Task 1: Add `dashboard.customers.root` to roots

**Files:**
- Modify: `src/shared/config/roots.ts`

- [ ] **Step 1: Add customers key under `dashboard`**

Open [src/shared/config/roots.ts](src/shared/config/roots.ts). Locate the `dashboard` block (line 19). After the `projects` nested key (ends around line 37) and before `schedule` (line 38), insert:

```ts
customers: {
  root: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/customers', options),
},
```

The final dashboard block should look like:

```ts
dashboard: {
  root: '/dashboard',
  /** @deprecated Use dashboard.pipeline(pipelineKey) instead */
  pipelines: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/pipeline/fresh', options),
  pipeline: (pipeline: string = 'fresh', options?: Parameters<typeof generateUrl>[1]) => generateUrl(`/dashboard/pipeline/${pipeline}`, options),
  meetings: {
    root: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/meetings', options),
    byId: (id: string, options?: Parameters<typeof generateUrl>[1]) => generateUrl(`/dashboard/meetings/${id}`, options),
  },
  proposals: {
    root: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/proposals', options),
    new: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/proposals/new', options),
    byId: (id: string, options?: Parameters<typeof generateUrl>[1]) => generateUrl(`/dashboard/proposals/${id}`, options),
  },
  projects: {
    root: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/projects', options),
    new: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/projects/new', options),
    byId: (id: string, options?: Parameters<typeof generateUrl>[1]) => generateUrl(`/dashboard/projects/${id}`, options),
  },
  customers: {
    root: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/customers', options),
  },
  schedule: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/schedule', options),
  settings: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/settings', options),
  intake: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/intake', options),
  team: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/team', options),
  analytics: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/analytics', options),
},
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: no errors. If lint complains about key ordering inside the `dashboard` block (perfectionist rule may apply), adjust position alphabetically — the exact position doesn't matter functionally.

- [ ] **Step 4: Commit**

```bash
git add src/shared/config/roots.ts
git commit -m "$(cat <<'EOF'
feat(roots): add dashboard.customers.root

Future entry point for the planned /dashboard/customers page. Used
immediately by the Records nav group as a disabled placeholder.

Part of #91

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Refactor `SidebarNavConfig` shape + add new items

**Files:**
- Modify: `src/features/agent-dashboard/lib/get-sidebar-nav.ts`

- [ ] **Step 1: Replace the file's contents with the new config shape**

Open [src/features/agent-dashboard/lib/get-sidebar-nav.ts](src/features/agent-dashboard/lib/get-sidebar-nav.ts) and replace entirely with:

```ts
import type { LucideIcon } from 'lucide-react'

import type { AppAbility } from '@/shared/domains/permissions/types'

import {
  BarChart3Icon,
  CalendarIcon,
  ClipboardListIcon,
  FileTextIcon,
  GitBranchIcon,
  HandshakeIcon,
  ImageIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  UsersIcon,
  UsersRoundIcon,
} from 'lucide-react'

import { ROOTS } from '@/shared/config/roots'
import { PIPELINE_LABELS } from '@/shared/domains/pipelines/constants/pipeline-registry'
import { getAccessiblePipelines } from '@/shared/domains/pipelines/lib/get-accessible-pipelines'

export interface SidebarNavSubItem {
  key: string
  label: string
  href: string
}

export interface SidebarNavItem {
  href: string
  icon: LucideIcon
  label: string
  enabled: boolean
  children?: readonly SidebarNavSubItem[]
}

export interface SidebarNavConfig {
  dashboardItem: SidebarNavItem
  mainItems: readonly SidebarNavItem[]
  recordsItems: readonly SidebarNavItem[]
  adminItems: readonly SidebarNavItem[]
  footerItems: readonly SidebarNavItem[]
}

export function getSidebarNav(ability: AppAbility): SidebarNavConfig {
  const dashboardItem: SidebarNavItem = {
    href: ROOTS.dashboard.root,
    icon: LayoutDashboardIcon,
    label: 'Dashboard',
    enabled: true,
  }

  const mainItems: SidebarNavItem[] = [
    {
      href: ROOTS.dashboard.pipeline(),
      icon: GitBranchIcon,
      label: 'Pipeline',
      enabled: ability.can('read', 'Customer'),
      children: getAccessiblePipelines(ability).map(key => ({
        key,
        label: PIPELINE_LABELS[key],
        href: ROOTS.dashboard.pipeline(key),
      })),
    },
    {
      href: ROOTS.dashboard.schedule(),
      icon: CalendarIcon,
      label: 'Schedule',
      enabled: ability.can('read', 'Meeting'),
    },
  ]

  const recordsItems: SidebarNavItem[] = [
    {
      href: ROOTS.dashboard.customers.root(),
      icon: UsersRoundIcon,
      label: 'Customers',
      enabled: false,
    },
    {
      href: ROOTS.dashboard.meetings.root(),
      icon: HandshakeIcon,
      label: 'Meetings',
      enabled: ability.can('read', 'Meeting'),
    },
    {
      href: ROOTS.dashboard.proposals.root(),
      icon: FileTextIcon,
      label: 'Proposals',
      enabled: ability.can('read', 'Proposal'),
    },
    {
      href: ROOTS.dashboard.projects.root(),
      icon: ImageIcon,
      label: 'Projects',
      enabled: ability.can('read', 'Project'),
    },
  ]

  const adminItems: SidebarNavItem[] = ability.can('manage', 'all')
    ? [
        { href: ROOTS.dashboard.intake(), icon: ClipboardListIcon, label: 'Intake Form', enabled: true },
        { href: ROOTS.dashboard.team(), icon: UsersIcon, label: 'Team', enabled: false },
        { href: ROOTS.dashboard.analytics(), icon: BarChart3Icon, label: 'Analytics', enabled: false },
      ]
    : []

  const footerItems: SidebarNavItem[] = [
    { href: ROOTS.dashboard.settings(), icon: SettingsIcon, label: 'Settings', enabled: true },
  ]

  return { dashboardItem, mainItems, recordsItems, adminItems, footerItems }
}
```

**Note on the Schedule href:** the previous file used a string literal `'/dashboard/schedule'`. Switching to `ROOTS.dashboard.schedule()` is consistent with how other items reference ROOTS.

- [ ] **Step 2: Type-check**

Run: `pnpm tsc`
Expected: PASS. If TypeScript complains that `HandshakeIcon`, `LayoutDashboardIcon`, or `UsersRoundIcon` don't exist on `lucide-react`, they do — these are all standard lucide icons. Verify with: `pnpm tsc 2>&1 | grep -i "has no exported" || echo "icons OK"`.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: PASS. Imports are already alphabetical (perfectionist). If lint auto-fixes anything, accept via `pnpm lint:fix`.

- [ ] **Step 4: Verify downstream compile**

Any existing consumer of `getSidebarNav` expects `{ baseItems, adminItems, footerItems }`. The only consumer is `app-sidebar.tsx`. `pnpm tsc` will now fail there with errors about missing `baseItems` — **this is expected**. Task 3 fixes it. Do not commit yet.

- [ ] **Step 5: Commit (after Task 3 passes tsc)**

Hold the commit for this task until Task 3 is complete and `pnpm tsc` passes. Combined commit message is in Task 3 Step N.

---

## Task 3: Render new config in `app-sidebar.tsx` (flat Records, non-collapsible first)

Render the new config shape without the `Collapsible` wrapper yet. This keeps the commit small and visually verifiable before adding the collapsible behavior in Task 4.

**Files:**
- Modify: `src/features/agent-dashboard/ui/components/app-sidebar.tsx`

- [ ] **Step 1: Update the render block**

Open [src/features/agent-dashboard/ui/components/app-sidebar.tsx](src/features/agent-dashboard/ui/components/app-sidebar.tsx). Locate `<SidebarContent>` (line 214) and replace the inner content. The full `<SidebarContent>` block should become:

```tsx
<SidebarContent>
  <SidebarGroup>
    <SidebarGroupContent>
      <SidebarMenu>
        {renderNavItem(navConfig.dashboardItem)}
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>

  <SidebarGroup>
    <SidebarGroupLabel>Main</SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        {navConfig.mainItems.map(item =>
          item.children ? renderPipelineNavItem(item) : renderNavItem(item),
        )}
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>

  <SidebarGroup>
    <SidebarGroupLabel>Records</SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        {navConfig.recordsItems.map(renderNavItem)}
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>

  {navConfig.adminItems.length > 0 && (
    <SidebarGroup>
      <SidebarGroupLabel>Admin</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {navConfig.adminItems.map(renderNavItem)}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )}
</SidebarContent>
```

The Dashboard item is rendered inside a `SidebarGroup` with no `SidebarGroupLabel` — this gives it the same padding/styling as other groups without an "Ungrouped" label. (If the visual gap feels wrong in verification, we'll adjust in Task 4.)

- [ ] **Step 2: Confirm no other changes are needed**

The existing `renderNavItem`, `renderPipelineNavItem`, `getIsActive`, `usePipelineChange`, pipeline state, and footer JSX stay as-is. The `getIsActive` function already handles `if (item.href === ROOTS.dashboard.root) return pathname === item.href`, so Dashboard's exact-match logic is already correct.

- [ ] **Step 3: Type-check**

Run: `pnpm tsc`
Expected: PASS (this is where Task 2's type errors resolve).

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 5: Manual browser verification**

Run: `pnpm dev` in one terminal, visit `http://localhost:3000/dashboard`.

Verify:
- [ ] Dashboard nav item visible at top of sidebar, ungrouped (no label above it)
- [ ] Clicking Dashboard when already on `/dashboard` keeps it active (primary color tint on icon)
- [ ] Navigating to `/dashboard/schedule` removes Dashboard active state (exact-match check works)
- [ ] Main group contains Pipeline + Schedule only
- [ ] Pipeline still has its pipeline sub-items (fresh, active, rehash, dead) working
- [ ] Records group contains Customers (grayed), Meetings, Proposals, Projects in that order
- [ ] Customers shows as disabled (reduced opacity, pointer-events-none — same as existing disabled Team/Analytics)
- [ ] Clicking Meetings, Proposals, Projects navigates correctly
- [ ] Admin group (if super-admin user) appears with Intake Form, Team, Analytics unchanged
- [ ] Footer (Action Center, Settings) unchanged
- [ ] Icon-collapsed sidebar (click the chevron button): all items become icons with tooltips; nothing disappears

Stop `pnpm dev` once verified.

- [ ] **Step 6: Commit Tasks 2 + 3 together**

```bash
git add src/features/agent-dashboard/lib/get-sidebar-nav.ts \
        src/features/agent-dashboard/ui/components/app-sidebar.tsx
git commit -m "$(cat <<'EOF'
refactor(nav): split Main/Records, add Dashboard top-level item

- New SidebarNavConfig shape: { dashboardItem, mainItems, recordsItems, adminItems, footerItems }
- Dashboard item (LayoutDashboardIcon) renders ungrouped above Main
- Main contains only Pipeline (with children) + Schedule
- New Records group: Customers (disabled placeholder) + Meetings + Proposals + Projects
- Admin and Footer unchanged
- Renders against existing routes — no page moves (/dashboard/customers page deferred)

Part of #91

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Wrap Records in collapsible group with chevron

Introduce a dedicated `<SidebarRecordsGroup>` component that wraps the Records `SidebarGroup` in shadcn `Collapsible`. The chevron sits in the label row and rotates on toggle. In icon-collapsed sidebar mode, `Collapsible` is forced open so items remain reachable.

**Files:**
- Create: `src/features/agent-dashboard/ui/components/sidebar-records-group.tsx`
- Modify: `src/features/agent-dashboard/ui/components/app-sidebar.tsx`

- [ ] **Step 1: Create the new component file**

Create [src/features/agent-dashboard/ui/components/sidebar-records-group.tsx](src/features/agent-dashboard/ui/components/sidebar-records-group.tsx):

```tsx
'use client'

import type { ReactNode } from 'react'

import type { SidebarNavItem } from '@/features/agent-dashboard/lib/get-sidebar-nav'

import { ChevronRightIcon } from 'lucide-react'
import { useState } from 'react'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  useSidebar,
} from '@/shared/components/ui/sidebar'

interface SidebarRecordsGroupProps {
  items: readonly SidebarNavItem[]
  renderItem: (item: SidebarNavItem) => ReactNode
}

export function SidebarRecordsGroup({ items, renderItem }: SidebarRecordsGroupProps) {
  const [userOpen, setUserOpen] = useState(true)
  const { state } = useSidebar()
  const isIconCollapsed = state === 'collapsed'
  const open = isIconCollapsed ? true : userOpen

  return (
    <Collapsible open={open} onOpenChange={setUserOpen}>
      <SidebarGroup>
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger className="flex w-full items-center justify-between hover:text-sidebar-foreground">
            <span>Records</span>
            <ChevronRightIcon
              className={`size-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
            />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(renderItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}
```

**Why this works:**
- `SidebarGroupLabel` already has `asChild` — we pass `CollapsibleTrigger` as the child so the entire label row is the click target.
- When `collapsible="icon"` is active on the outer `<Sidebar>`, `SidebarGroupLabel` hides itself via `group-data-[collapsible=icon]:opacity-0` + `-mt-8` (already in the shadcn styles). The `Collapsible` being forced open means the items under `CollapsibleContent` remain mounted and render as icons.
- `hover:text-sidebar-foreground` gives a subtle affordance that the label is clickable without adding a background.

- [ ] **Step 2: Wire the new component into `app-sidebar.tsx`**

Open [src/features/agent-dashboard/ui/components/app-sidebar.tsx](src/features/agent-dashboard/ui/components/app-sidebar.tsx).

Add the import (placed alphabetically with other feature imports near the top):

```tsx
import { SidebarRecordsGroup } from '@/features/agent-dashboard/ui/components/sidebar-records-group'
```

Replace the Records `SidebarGroup` block (the one with `<SidebarGroupLabel>Records</SidebarGroupLabel>` from Task 3) with:

```tsx
<SidebarRecordsGroup
  items={navConfig.recordsItems}
  renderItem={renderNavItem}
/>
```

The full `<SidebarContent>` block is now:

```tsx
<SidebarContent>
  <SidebarGroup>
    <SidebarGroupContent>
      <SidebarMenu>
        {renderNavItem(navConfig.dashboardItem)}
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>

  <SidebarGroup>
    <SidebarGroupLabel>Main</SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        {navConfig.mainItems.map(item =>
          item.children ? renderPipelineNavItem(item) : renderNavItem(item),
        )}
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>

  <SidebarRecordsGroup
    items={navConfig.recordsItems}
    renderItem={renderNavItem}
  />

  {navConfig.adminItems.length > 0 && (
    <SidebarGroup>
      <SidebarGroupLabel>Admin</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {navConfig.adminItems.map(renderNavItem)}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )}
</SidebarContent>
```

- [ ] **Step 3: Type-check**

Run: `pnpm tsc`
Expected: PASS.

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: PASS. If lint wants imports re-ordered, run `pnpm lint:fix`.

- [ ] **Step 5: Manual browser verification**

Run: `pnpm dev`, visit `http://localhost:3000/dashboard`.

Verify:
- [ ] Records group shows a chevron (right-pointing) next to the "Records" label
- [ ] Clicking the label (or chevron area — whole row is the trigger) collapses the group; chevron rotates to point down
- [ ] Clicking again expands; chevron rotates back
- [ ] Records items (Customers disabled, Meetings, Proposals, Projects) visible when expanded
- [ ] Toggle state is per-session (React state) — refreshing the page resets to open. This is acceptable for this PR; persistence is a follow-up.
- [ ] In **icon-collapsed sidebar** mode (collapse via the circular chevron button on the header): Records items render as individual icons with tooltips, even if the group was previously collapsed in expanded mode. Hover tooltips say "Customers", "Meetings", "Proposals", "Projects".
- [ ] Expanding the sidebar again restores the user's last open/closed toggle state for Records.
- [ ] Mobile: open the sidebar via the hamburger (bottom nav). Records group is collapsible via tap. Navigating to a Records item closes the mobile sheet (existing `setOpenMobile(false)` behavior from `renderNavItem`).
- [ ] Dashboard item still active only on `/dashboard` exactly.
- [ ] Pipeline sub-items still work.
- [ ] Admin group (super-admin) unchanged.

Stop `pnpm dev`.

- [ ] **Step 6: Commit**

```bash
git add src/features/agent-dashboard/ui/components/sidebar-records-group.tsx \
        src/features/agent-dashboard/ui/components/app-sidebar.tsx
git commit -m "$(cat <<'EOF'
feat(nav): collapsible Records group with chevron

Extract <SidebarRecordsGroup> that wraps the group in shadcn Collapsible.
Chevron in the label row rotates 90deg on toggle. In icon-collapsed
sidebar mode the Collapsible is forced open so items remain reachable
as individual icons — matches existing SidebarGroup icon-collapsed UX.

Part of #91

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Final verification + PR

- [ ] **Step 1: Run full checks**

```bash
pnpm tsc && pnpm lint
```
Expected: both PASS.

- [ ] **Step 2: Review the full diff**

```bash
git diff main..HEAD -- src/features/agent-dashboard src/shared/config/roots.ts
```

Sanity-check:
- No stray `console.log` / debug code
- No unrelated changes (no edits to unrelated files)
- All icons imported are actually used

- [ ] **Step 3: Confirm success criteria from spec**

Walk the spec's `Success Criteria` section — each bullet must pass:

- [ ] Dashboard item at top, ungrouped, active only on `/dashboard` exactly
- [ ] Main = Pipeline (with sub-items) + Schedule
- [ ] Records group has chevron, toggles, default open
- [ ] Records contains Customers (disabled), Meetings, Proposals, Projects in order
- [ ] Customers visibly disabled
- [ ] Admin group unchanged in appearance/gating
- [ ] Footer unchanged
- [ ] Icon-collapsed sidebar renders Records items as icon stack
- [ ] Mobile sheet renders the new structure

- [ ] **Step 4: Push and open PR**

```bash
git push -u origin refactor/91-dashboard-nav-restructure

gh pr create --title "refactor(nav): dashboard sidebar restructure (#91)" --body "$(cat <<'EOF'
## Summary

- New `Dashboard` top-level nav item (LayoutDashboardIcon, ungrouped)
- Split `Main` into Pipeline + Schedule only
- New collapsible `Records` group: Customers (disabled placeholder), Meetings, Proposals, Projects
- `SidebarNavConfig` refactored to self-documenting named fields
- No route changes — Records entries point at existing `/dashboard/{meetings,proposals,projects}` pages

## Deferred (separate issue)

- Building `/dashboard/customers` page (Customers nav enables once shipped)
- Consolidating record pages under `/dashboard/records/*` with shared layout + generic `RecordsView`

## Changes

- `src/shared/config/roots.ts` — add `dashboard.customers.root`
- `src/features/agent-dashboard/lib/get-sidebar-nav.ts` — new config shape, new items
- `src/features/agent-dashboard/ui/components/app-sidebar.tsx` — render Dashboard ungrouped + wire Records group
- `src/features/agent-dashboard/ui/components/sidebar-records-group.tsx` — new; collapsible Records component
- `docs/superpowers/specs/2026-04-20-dashboard-nav-restructure-design.md` — design spec
- `docs/superpowers/plans/2026-04-20-dashboard-nav-restructure.md` — implementation plan

## Self-Review

- [x] `pnpm tsc` passes
- [x] `pnpm lint` passes
- [x] Manually verified in dev (desktop expanded, desktop icon-collapsed, mobile sheet)
- [x] All items in spec's Success Criteria pass

## Test Plan

- [ ] Visit `/dashboard` — Dashboard item active
- [ ] Click Main items — activate correctly, Dashboard deactivates
- [ ] Click Records label — collapse/expand with chevron rotation
- [ ] Collapse sidebar to icons — Records items still reachable
- [ ] Mobile: open sidebar via hamburger, tap Records label, tap a Records item — sheet closes

Closes #91
EOF
)"
```

- [ ] **Step 5: Move issue to "In Review" on the project board**

```bash
gh project item-edit --project-id PVT_kwHOCqZfGM4BSgDZ \
  --id PVTI_lAHOCqZfGM4BSgDZzgqeYqY \
  --field-id PVTSSF_lAHOCqZfGM4BSgDZzhAA_t4 \
  --single-select-option-id e461e967
```

- [ ] **Step 6: Commit the implementation plan doc**

Plan file isn't committed yet — commit it now so the PR carries the design trail:

```bash
git add docs/superpowers/plans/2026-04-20-dashboard-nav-restructure.md
git commit --amend --no-edit
git push --force-with-lease
```

(Amending the last commit is acceptable here since the branch hasn't been reviewed yet — the plan doc belongs with the final commit.)

---

## Notes for the Implementer

- **Do not run `pnpm build`.** Use `pnpm tsc` for type-checking (project rule; see CLAUDE.md auto-memory).
- **Do not add a test runner.** This project has no UI test infrastructure; verification is `pnpm tsc` + `pnpm lint` + manual browser checks.
- **Branch is already created:** `refactor/91-dashboard-nav-restructure`. Issue #91 is already in "In Progress" on the project board.
- **Spec is already committed** in commit `9f46f79` on this branch.
- If any icon (`HandshakeIcon`, `LayoutDashboardIcon`, `UsersRoundIcon`) is missing from the local `lucide-react` version, substitute with: `Handshake` → `UsersIcon`, `LayoutDashboard` → `HomeIcon`, `UsersRound` → `UserIcon`. Run `pnpm tsc` to confirm the imports resolve.
