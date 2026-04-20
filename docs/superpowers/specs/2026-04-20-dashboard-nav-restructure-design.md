# Dashboard Nav Restructure — Design Spec

**Date:** 2026-04-20
**Author:** Oliver P (via Claude Code brainstorming session)
**Status:** Approved, pending implementation plan

## Problem

The agent dashboard sidebar groups "operational" items (Pipeline, Schedule) and "reference" items (Proposals, Projects) into the same `Main` group. There is no top-level "Dashboard" home item — the logo is the only way to reach `/dashboard`. Customers have no nav entry despite being the parent entity of the data model.

This spec restructures the sidebar to reflect two distinct mental models:

- **Operational** (things you act on today): Pipeline, Schedule
- **Records** (history / archive you browse): Customers, Meetings, Proposals, Projects

…with a new `Dashboard` top-level item as the universal home.

## Goals

- Add a new `Dashboard` nav item at the top, ungrouped
- Split the current `Main` group: keep Pipeline + Schedule; move Proposals + Projects to a new `Records` group; add Meetings and Customers to `Records`
- Make the `Records` group collapsible (shadcn `Collapsible` + `SidebarGroup` with a chevron in the label row)
- Convert `getSidebarNav` to a self-documenting config shape with named fields for each group
- Ship without requiring the records page migration (deferred — see `project-records-migration.md` in memory)

## Non-Goals

- Building a `/dashboard/customers` page (deferred; Customers nav item ships `enabled: false`)
- Migrating `/dashboard/{meetings,proposals,projects}` to `/dashboard/records/*`
- Changing the mobile bottom nav or Action Center sheet
- Any omni-search work (separate future feature)

## Final Nav Structure

```
(logo)
────────────
Dashboard                            → /dashboard             LayoutDashboardIcon  (ungrouped)

Main
├── Pipeline                         → /dashboard/pipeline/:key   GitBranchIcon  (unchanged, keeps children)
└── Schedule                         → /dashboard/schedule        CalendarIcon

Records  ▸  (collapsible, chevron in label row)
├── Customers   (disabled)           → /dashboard/customers       UsersRoundIcon
├── Meetings                         → /dashboard/meetings        HandshakeIcon
├── Proposals                        → /dashboard/proposals       FileTextIcon
└── Projects                         → /dashboard/projects        ImageIcon

Admin   (super-admin only, unchanged)
├── Intake Form                      → /dashboard/intake          ClipboardListIcon
├── Team (disabled)                  → /dashboard/team            UsersIcon
└── Analytics (disabled)             → /dashboard/analytics       BarChart3Icon

Footer
├── Action Center (button → sheet)                                ZapIcon
└── Settings                         → /dashboard/settings        SettingsIcon
```

### Ordering rationale

Records order is chronological along the customer lifecycle: **Customer → Meeting → Proposal → Project**. Matches `project-entity-model.md` and how agents think about deal progression.

### Icon choices

| Item | Icon | Why |
| --- | --- | --- |
| Dashboard | `LayoutDashboardIcon` | Convention; reads as "home / overview" |
| Customers | `UsersRoundIcon` | Distinct from `UsersIcon` (Team), clearer silhouette |
| Meetings | `HandshakeIcon` | Matches "in-home meeting" mental model |
| Proposals | `FileTextIcon` | Unchanged |
| Projects | `ImageIcon` | Unchanged (matches portfolio / visual showcase) |

Icons are easy to swap post-implementation if any feel off.

## Config Shape

**File:** `src/features/agent-dashboard/lib/get-sidebar-nav.ts`

```ts
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
  dashboardItem: SidebarNavItem            // always present, ungrouped, above first group
  mainItems: readonly SidebarNavItem[]     // Pipeline, Schedule
  recordsItems: readonly SidebarNavItem[]  // Customers (disabled), Meetings, Proposals, Projects
  adminItems: readonly SidebarNavItem[]    // unchanged
  footerItems: readonly SidebarNavItem[]   // unchanged
}

export function getSidebarNav(ability: AppAbility): SidebarNavConfig
```

### Permission gating per item

| Item | Gate |
| --- | --- |
| Dashboard | always enabled for authenticated users |
| Pipeline | `ability.can('read', 'Customer')` (unchanged) |
| Schedule | `ability.can('read', 'Meeting')` (unchanged) |
| Customers | `enabled: false` this PR (disabled placeholder); later gate: `ability.can('read', 'Customer')` |
| Meetings | `ability.can('read', 'Meeting')` |
| Proposals | `ability.can('read', 'Proposal')` (unchanged) |
| Projects | `ability.can('read', 'Project')` (unchanged) |
| Admin group | `ability.can('manage', 'all')` (unchanged) |

## Sidebar Rendering

**File:** `src/features/agent-dashboard/ui/components/app-sidebar.tsx`

### Dashboard item (ungrouped)

Rendered directly inside `SidebarContent` before the first `SidebarGroup`. Uses the same `renderNavItem` helper as group items — no new component required.

### Active-path logic for Dashboard

```ts
if (item.href === ROOTS.dashboard.root) {
  return pathname === item.href  // exact match, not prefix
}
```

This already exists in `getIsActive`. No change needed; just ensure Dashboard item uses `ROOTS.dashboard.root`.

### Records group (collapsible)

Use shadcn `Collapsible` wrapping `SidebarGroup`. The chevron sits in the `SidebarGroupLabel` row, justify-between with the label text. Clicking the label toggles open/closed.

**Pattern reference:** shadcn's official sidebar-07 / collapsible sidebar pattern. Pull exact JSX via shadcn mcp (`mcp__shadcn__search_items_in_registries` → `mcp__shadcn__view_items_in_registries`) at implementation time to match the current shadcn API.

**Default state:** open. Remembering the collapsed state across sessions is out of scope for this PR (easy follow-up via `localStorage` if desired).

**Collapsed state when sidebar is icon-collapsed:** The outer `Sidebar collapsible="icon"` hides labels and shows only icons. In this state the Records `Collapsible` must be **forced open** so items remain visible (otherwise users lose nav access with no label to click). Implementation: drive the `Collapsible` `open` prop with `state === 'collapsed' ? true : userToggleState`. Chevron in the label row is naturally hidden with the rest of the label.

## Routes Config

**File:** `src/shared/config/roots.ts`

Add a `customers` key under `dashboard`:

```ts
customers: {
  root: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/dashboard/customers', options),
},
```

Pattern matches existing `proposals`, `projects` nested keys. Only `root` is added now — `byId` and others are deferred to the records migration.

## Files Touched

1. `src/features/agent-dashboard/lib/get-sidebar-nav.ts` — new config shape, add Dashboard + Meetings + Customers items, split base into main/records
2. `src/features/agent-dashboard/ui/components/app-sidebar.tsx` — render ungrouped Dashboard, wrap Records group in Collapsible, update renderers to accept the new config shape
3. `src/shared/config/roots.ts` — add `dashboard.customers.root`
4. Possibly `src/features/agent-dashboard/constants/sidebar-styles.ts` — if collapsible label needs a subtle style override (TBD during implementation)

No test files exist for this module today; adding tests is out of scope unless the implementation reveals logic worth locking down (e.g., `getSidebarNav` output snapshot).

## Risk and Rollback

**Risk:** Low. Nav changes are visible and obvious — breakage surfaces immediately.

**Rollback:** Single-commit revert. No DB migrations, no URL changes, no breaking API.

**Compat note:** Existing bookmarks/links still work. `/dashboard/meetings`, `/proposals`, `/projects` all continue to render — this PR only changes the nav, not the routes.

## Success Criteria

- Dashboard item at top of sidebar, ungrouped, active only on `/dashboard` exactly
- `Main` contains only Pipeline (with sub-items) + Schedule
- `Records` group renders with chevron in label row; clicking toggles; default open
- Records contains Customers (disabled), Meetings, Proposals, Projects in that order
- Customers nav item is visibly disabled (matches Team/Analytics disabled styling)
- Admin group unchanged in appearance and gating
- Footer unchanged
- Icon-collapsed sidebar still works (Records items render as icon stack)
- Mobile sidebar (the Sheet opened by hamburger) renders the new structure correctly
- `pnpm tsc` + `pnpm lint` pass

## Deferred Work

See `project-records-migration.md` in memory:

1. Build `/dashboard/customers` page (move customer table out of pipeline)
2. Create `/dashboard/records/layout.tsx` with shared shell
3. Migrate meetings/proposals/projects pages into `/dashboard/records/*` or redirect
4. Build generic `<RecordsView>` component parameterized by entity
5. Enable the Customers nav item once the page exists
