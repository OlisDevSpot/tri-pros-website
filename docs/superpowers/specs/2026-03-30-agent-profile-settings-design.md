# Agent Profile & Settings — Design Spec

**Issue**: #9 — Agent Profile & Settings
**Branch**: `feat/9-agent-profile-settings`
**Date**: 2026-03-30
**Related**: #56 (dashboard routing refactor — follow-up)

---

## Overview

Full-screen dashboard layout with a role-aware shadcn Sidebar, plus an agent profile & settings page. The sidebar replaces the current narrow icon bar with a collapsible, fixed-position navigation panel that adapts by user role. The profile page lets agents manage personal info, customer-facing brand data (for proposals), and app settings.

## Scope

### In Scope

- Replace dashboard layout with full-screen `SidebarProvider` + `SidebarInset`
- New `AppSidebar` component using shadcn `Sidebar` (collapsible, role-aware)
- Sidebar nav config computed from `userRole` via pure function
- Agent profile & settings page (new dashboard step: `settings`)
- New DB columns on `user` table + `agentProfileJSON` JSONB column
- New entity schema: `src/shared/entities/agents/schemas.ts`
- New feature: `src/features/agent-settings/`
- Background gradient: Atmospheric Glow (radial from top-center)
- Super-admin nav items (Intake Form, Team, Analytics) as placeholders

### Out of Scope

- Intake form overhaul (captured in memory, follow-up issue)
- Dashboard routing refactor to nested routes (#56)
- Actual analytics/team/intake pages (placeholder `EmptyState` only)
- Headshot crop tool (upload only in this issue; crop UI is future work)

---

## 1. Layout Architecture

### Dashboard Layout (`src/app/(frontend)/dashboard/layout.tsx`)

Replaces the current `container`-constrained layout with a full-screen sidebar layout.

```
SidebarProvider (defaultOpen=true, cookie-persisted)
├── AppSidebar (fixed position, collapsible="icon" on desktop)
└── SidebarInset (main content area)
    ├── Mobile top bar: SidebarTrigger + context breadcrumb
    ├── Atmospheric Glow gradient background
    └── children (page content with padding)
```

**Key properties:**
- `SidebarProvider`: wraps entire dashboard, manages open/collapsed state, persists to cookie
- `AppSidebar`: `side="left"`, `collapsible="icon"` on desktop
- `SidebarInset`: main content area, full-width, scrollable
- Keyboard shortcut: `Ctrl+B` to toggle (built into `SidebarProvider`)

### Background Gradient

**Atmospheric Glow** — soft radial from top-center using primary color:

```css
/* Light mode */
background: radial-gradient(
  ellipse 80% 50% at 50% 0%,
  color-mix(in oklch, var(--primary) 35%, transparent),
  var(--background) 70%
),
var(--background);

/* Dark mode */
background: radial-gradient(
  ellipse 80% 50% at 50% 0%,
  color-mix(in oklch, var(--primary) 40%, transparent),
  var(--background) 70%
),
var(--background);
```

Applied to `SidebarInset` so the sidebar has its own `bg-sidebar` background.

### Mobile Behavior

On mobile, the sidebar renders the same `Sidebar` component (not a Sheet) for UI consistency. The collapsible behavior differs by breakpoint:

- **Desktop** (`md+`): `collapsible="icon"` — collapses to 3rem icon-only rail
- **Mobile** (`< md`): `collapsible="offcanvas"` — collapses to 0 width (fully hidden)

The `SidebarTrigger` button renders in the `SidebarInset` top bar on mobile. When toggled, the sidebar slides in from the left as the same component with full nav visible. Tapping a nav item or the backdrop closes it. No icons are visible in the collapsed/hidden mobile state — only the trigger button.

### CSS Variables

Remove the old `--sidebar-width: 148px` and `--sidebar-height: 68px`. The shadcn sidebar manages its own width via `--sidebar-width: 16rem` and `--sidebar-width-icon: 3rem`.

---

## 2. Sidebar Component

### File: `src/features/agent-dashboard/ui/components/app-sidebar.tsx`

Uses the shadcn `Sidebar` primitive with three sections:

```
Sidebar (side="left", variant="sidebar", collapsible="icon")
├── SidebarHeader
│   └── SidebarMenuButton (size="lg", asChild)
│       └── Link to "/"
│           ├── Expanded: logo-light-right.svg / logo-dark-right.svg
│           └── Collapsed: logo-light.svg (small icon logo)
├── SidebarContent
│   ├── SidebarGroup (label: "Main")
│   │   └── SidebarMenu
│   │       └── base nav items (all roles)
│   └── SidebarGroup (label: "Admin") — super-admin only
│       └── SidebarMenu
│           └── admin nav items
├── SidebarFooter
│   ├── SidebarMenu
│   │   └── Settings nav item
│   └── SidebarMenu
│       └── User dropdown (SidebarMenuButton size="lg")
│           ├── Avatar + name + email (expanded)
│           ├── Avatar only (collapsed, with tooltip)
│           └── DropdownMenu: profile link, logout
└── SidebarRail (edge drag/click to toggle)
```

### Logo Behavior

Read `state` from `useSidebar()`:
- **Expanded** (`state === 'expanded'`): Render `logo-light-right.svg` / `logo-dark-right.svg` (full horizontal logo with text)
- **Collapsed** (`state === 'collapsed'`): Render `logo-light.svg` (square icon mark only)

Dark mode variants use the `.dark` CSS class (existing pattern in the codebase).

### Nav Item Rendering

Each item renders as:
```
SidebarMenuItem
└── SidebarMenuButton (tooltip={item.label}, isActive={step === item.step})
    ├── <item.icon /> (size 4, shrink-0)
    └── <span>{item.label}</span>
```

In expanded state: icon and label visible, `justify-start` with `gap-4` between icon and label text.
In collapsed state: only icon visible (centered in 3rem width), label hidden. Tooltip shows label on hover.

### Active State

`SidebarMenuButton` receives `isActive={step === item.step}`. This applies `bg-sidebar-accent` + `text-sidebar-accent-foreground` + `font-medium` (built into shadcn variants).

---

## 3. Nav Configuration

### File: `src/features/agent-dashboard/lib/get-sidebar-nav.ts`

Pure function, called once on mount:

```ts
import type { UserRole } from '@/shared/types/enums'
import type { LucideIcon } from 'lucide-react'
import type { DashboardStep } from '@/features/agent-dashboard/types'

interface SidebarNavItem {
  step: DashboardStep
  icon: LucideIcon
  label: string
  enabled: boolean
  badge?: number
}

interface SidebarNavConfig {
  baseItems: SidebarNavItem[]
  adminItems: SidebarNavItem[]
  footerItems: SidebarNavItem[]
}

function getSidebarNav(userRole: UserRole): SidebarNavConfig
```

### Nav Items

**Base items** (all roles):

| Icon | Label | Step | Enabled |
|------|-------|------|---------|
| `LayoutDashboard` | Dashboard | `dashboard` | `false` (placeholder) |
| `GitBranch` | Pipelines | `customer-pipelines` | `true` |
| `Calendar` | Meetings | `meetings` | `true` |
| `FileText` | Proposals | `proposals` | `true` |
| `Image` | Showroom | `showroom` | `true` |

**Admin items** (super-admin only — empty array for other roles):

| Icon | Label | Step | Enabled |
|------|-------|------|---------|
| `ClipboardList` | Intake Form | `intake` | `false` (placeholder) |
| `Users` | Team | `team` | `false` (placeholder) |
| `BarChart3` | Analytics | `analytics` | `false` (placeholder) |

**Footer items** (all roles):

| Icon | Label | Step | Enabled |
|------|-------|------|---------|
| `Settings` | Settings | `settings` | `true` |

### DashboardStep Type Update

Expand the union in `src/features/agent-dashboard/types/index.ts`:

```ts
type DashboardStep =
  // Existing
  | 'customer-pipelines'
  | 'meetings'
  | 'proposals'
  | 'create-proposal'
  | 'edit-proposal'
  | 'showroom'
  | 'create-project'
  | 'edit-project'
  // New
  | 'dashboard'
  | 'settings'
  | 'intake'
  | 'team'
  | 'analytics'
```

Placeholder steps (`dashboard`, `intake`, `team`, `analytics`) render `EmptyState` with "Coming soon" message in `DashboardHub`.

---

## 4. Profile & Settings Page

### Feature: `src/features/agent-settings/`

```
src/features/agent-settings/
├── constants/
│   ├── languages.ts            # Language options array
│   └── settings-sections.ts    # Section metadata (titles, descriptions)
├── lib/
│   └── format-tenure.ts        # Calculate tenure string from startDate
├── schemas/
│   └── profile-form.ts         # RHF + Zod form schema for the settings page
├── types/
│   └── index.ts                # Feature types
├── ui/
│   ├── views/
│   │   └── settings-view.tsx   # Main view (layout, scroll container, section grid)
│   └── components/
│       ├── profile-header-card.tsx       # Avatar, name, role badge, email
│       ├── identity-contact-section.tsx  # Phone, birthdate, start date, fun fact
│       ├── customer-brand-section.tsx    # Quote, bio, experience, trades, languages, certs
│       ├── headshot-upload.tsx           # Upload + preview (app vs proposal)
│       ├── app-settings-section.tsx      # Theme, default view, notifications
│       ├── company-info-section.tsx      # Read-only company data + useful links
│       └── admin-section.tsx             # Super-admin only: intake link, team link
└── dal/
    └── server/
        └── update-agent-profile.ts      # DAL for profile update mutation
```

### Page Layout

`SettingsView` is a scrollable page with card-based sections in a responsive grid:

```
SettingsView
├── Profile Header Card (full width)
│   ├── Avatar / headshot preview (clickable)
│   ├── Name (from session), role badge, email (read-only)
│   ├── Start date + calculated tenure
│   └── Edit button (toggles form mode)
├── Two-column grid (lg:grid-cols-2, stacks on mobile)
│   ├── Identity & Contact Card
│   │   ├── Phone (tel input, optional)
│   │   ├── Birthdate (date picker, optional)
│   │   ├── Start date at Tri Pros (date picker, optional)
│   │   └── Fun fact / hobby (text input, optional)
│   ├── App Settings Card
│   │   ├── Theme (light / dark / system toggle)
│   │   ├── Default dashboard view (select)
│   │   └── Notifications (disabled placeholder)
│   ├── Customer-Facing Brand Card (full width or large)
│   │   ├── Headshot upload with preview
│   │   ├── Personal quote / tagline (textarea, max ~200 chars)
│   │   ├── Bio / "My Story" (textarea, max ~1000 chars)
│   │   ├── Years of experience (number input)
│   │   ├── Trade specialties (multi-select from existing trades)
│   │   ├── Languages spoken (multi-select)
│   │   └── Personal certifications (tag input)
│   └── Company Info Card (read-only)
│       ├── Company name, license number, contact info
│       └── Useful links (external: Pipedrive, Monday.com, etc.)
└── Admin Section (super-admin only, full width)
    ├── Intake form quick-access link
    └── Team overview link
```

### Form Handling

- Uses React Hook Form + Zod (project convention)
- Each section card has its own save button (section-level saves, not page-level)
- Uses `useMutation(trpc.agentSettings.updateProfile.mutationOptions())` pattern
- Success feedback via toast
- All fields optional except name/email (read-only from OAuth)

---

## 5. Data Model Changes

### User Table Additions (`src/shared/db/schema/auth.ts`)

New nullable columns:

| Column | Type | Notes |
|--------|------|-------|
| `phone` | `text()` | Agent phone number |
| `birthdate` | `text()` | ISO date string (date only, no time) |
| `startDate` | `text()` | ISO date string, tenure at Tri Pros |
| `funFact` | `text()` | Hobby or fun fact |
| `agentProfileJSON` | `jsonb()` | Customer-facing brand data |

### Entity Schema: `src/shared/entities/agents/schemas.ts`

```ts
import { z } from 'zod'

const cropDataSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
})

export const agentProfileSchema = z.object({
  quote: z.string().optional(),
  bio: z.string().optional(),
  yearsOfExperience: z.number().optional(),
  tradeSpecialties: z.array(z.string()).optional(),
  languagesSpoken: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  headshotUrl: z.string().optional(),
  headshotCropData: z.object({
    app: cropDataSchema.optional(),
    proposal: cropDataSchema.optional(),
  }).optional(),
})

export type AgentProfile = z.infer<typeof agentProfileSchema>
```

### tRPC Router: `src/trpc/routers/agent-settings.router.ts`

New router registered in `app.ts`:

| Procedure | Auth | Description |
|-----------|------|-------------|
| `getProfile` | `agentProcedure` | Returns current user + agentProfileJSON |
| `updateProfile` | `agentProcedure` | Updates user columns + agentProfileJSON |
| `getHeadshotUploadUrl` | `agentProcedure` | Returns presigned R2 upload URL |

---

## 6. Migration Path to Nested Routes (#56)

This design prepares for the routing refactor:

- `getSidebarNav()` returns items with a `step` field. Adding an `href` field later is trivial.
- Active state check (`step === item.step`) can swap to `pathname.startsWith(item.href)`.
- Each view is its own component — moving into a `page.tsx` is a file move, not a rewrite.
- `SidebarProvider` + `AppSidebar` already lives in `layout.tsx` — no change needed.
- The `?step=` param pattern moves DOWN into individual pages for sub-navigation when routes are introduced.

---

## 7. Files to Create

| File | Purpose |
|------|---------|
| `src/features/agent-dashboard/ui/components/app-sidebar.tsx` | New shadcn sidebar component |
| `src/features/agent-dashboard/lib/get-sidebar-nav.ts` | Nav config function |
| `src/features/agent-settings/ui/views/settings-view.tsx` | Settings page view |
| `src/features/agent-settings/ui/components/profile-header-card.tsx` | Profile header |
| `src/features/agent-settings/ui/components/identity-contact-section.tsx` | Contact fields |
| `src/features/agent-settings/ui/components/customer-brand-section.tsx` | Brand fields |
| `src/features/agent-settings/ui/components/headshot-upload.tsx` | Headshot upload |
| `src/features/agent-settings/ui/components/app-settings-section.tsx` | App settings |
| `src/features/agent-settings/ui/components/company-info-section.tsx` | Company info |
| `src/features/agent-settings/ui/components/admin-section.tsx` | Super-admin section |
| `src/features/agent-settings/constants/languages.ts` | Language options |
| `src/features/agent-settings/constants/settings-sections.ts` | Section metadata |
| `src/features/agent-settings/lib/format-tenure.ts` | Tenure formatter |
| `src/features/agent-settings/schemas/profile-form.ts` | Form schema |
| `src/features/agent-settings/types/index.ts` | Feature types |
| `src/features/agent-settings/dal/server/update-agent-profile.ts` | DAL |
| `src/shared/entities/agents/schemas.ts` | AgentProfile JSONB schema |
| `src/trpc/routers/agent-settings.router.ts` | tRPC router |

## 8. Files to Modify

| File | Change |
|------|--------|
| `src/app/(frontend)/dashboard/layout.tsx` | Replace container layout with `SidebarProvider` + `AppSidebar` + `SidebarInset` + gradient |
| `src/features/agent-dashboard/ui/views/dashboard-hub.tsx` | Add `settings` step + placeholder steps, remove inline sidebar |
| `src/features/agent-dashboard/types/index.ts` | Expand `DashboardStep` union |
| `src/features/agent-dashboard/lib/url-parsers.ts` | Update step parser for new values |
| `src/features/agent-dashboard/constants/sidebar-items.ts` | Remove (replaced by `get-sidebar-nav.ts`) |
| `src/features/agent-dashboard/ui/components/dashboard-sidebar.tsx` | Remove (replaced by `app-sidebar.tsx`) |
| `src/shared/db/schema/auth.ts` | Add new user columns |
| `src/trpc/routers/app.ts` | Register `agentSettingsRouter` |
