# Agent Profile & Settings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard layout with a full-screen shadcn Sidebar + build agent profile/settings page.

**Architecture:** shadcn `SidebarProvider` wraps the dashboard layout. A new `AppSidebar` component renders role-aware nav items computed from a pure function. The profile page is a new `settings` step in the existing query-param routing pattern, with section-level forms using RHF + Zod.

**Tech Stack:** Next.js 15, shadcn/ui Sidebar, Drizzle ORM, tRPC, React Hook Form, Zod, Cloudflare R2, nuqs, better-auth, Tailwind v4

---

## File Map

### Create

| File | Responsibility |
|------|---------------|
| `src/features/agent-dashboard/lib/get-sidebar-nav.ts` | Pure function: `getSidebarNav(userRole)` → nav config |
| `src/features/agent-dashboard/ui/components/app-sidebar.tsx` | Dashboard sidebar using shadcn Sidebar primitives |
| `src/features/agent-dashboard/ui/components/sidebar-user-button.tsx` | User dropdown in sidebar footer (avatar + logout) |
| `src/shared/entities/agents/schemas.ts` | `agentProfileSchema` Zod schema + `AgentProfile` type |
| `src/features/agent-settings/constants/languages.ts` | Language options const array |
| `src/features/agent-settings/constants/company-info.ts` | Company metadata + useful links |
| `src/features/agent-settings/lib/format-tenure.ts` | Tenure calculation from startDate |
| `src/features/agent-settings/schemas/profile-form.ts` | RHF + Zod form schemas (per-section) |
| `src/features/agent-settings/types/index.ts` | Feature types |
| `src/features/agent-settings/ui/views/settings-view.tsx` | Main settings page layout |
| `src/features/agent-settings/ui/components/profile-header-card.tsx` | Header card with avatar, name, role |
| `src/features/agent-settings/ui/components/identity-contact-section.tsx` | Phone, birthdate, start date, fun fact |
| `src/features/agent-settings/ui/components/customer-brand-section.tsx` | Quote, bio, experience, trades, languages, certs |
| `src/features/agent-settings/ui/components/headshot-upload.tsx` | Headshot upload + dual preview |
| `src/features/agent-settings/ui/components/app-settings-section.tsx` | Theme, default view, notifications |
| `src/features/agent-settings/ui/components/company-info-section.tsx` | Read-only company data + links |
| `src/features/agent-settings/ui/components/admin-section.tsx` | Super-admin quick links |
| `src/trpc/routers/agent-settings.router.ts` | tRPC router: getProfile, updateProfile, getHeadshotUploadUrl |

### Modify

| File | Change |
|------|--------|
| `src/shared/db/schema/auth.ts` | Add 5 nullable columns to `user` table |
| `src/shared/auth/server.ts` | Register new `additionalFields` with better-auth |
| `src/features/agent-dashboard/constants/dashboard-steps.ts` | Add new step values |
| `src/features/agent-dashboard/types/index.ts` | Type auto-updates from const array |
| `src/features/agent-dashboard/lib/url-parsers.ts` | No code change needed (reads from const) |
| `src/app/(frontend)/dashboard/layout.tsx` | Replace with `SidebarProvider` + `SidebarInset` + gradient |
| `src/app/(frontend)/dashboard/page.tsx` | Pass `session` to `DashboardHub` |
| `src/features/agent-dashboard/ui/views/dashboard-hub.tsx` | Remove inline sidebar, add new steps, accept session prop |
| `src/features/agent-dashboard/constants/sidebar-items.ts` | Delete file |
| `src/features/agent-dashboard/ui/components/dashboard-sidebar.tsx` | Delete file |
| `src/trpc/routers/app.ts` | Register `agentSettingsRouter` |

---

## Task 1: Schema & Entity Foundation

**Files:**
- Modify: `src/shared/db/schema/auth.ts`
- Modify: `src/shared/auth/server.ts`
- Create: `src/shared/entities/agents/schemas.ts`

- [ ] **Step 1: Add new columns to user table**

In `src/shared/db/schema/auth.ts`, add imports and columns:

```ts
// Add jsonb to the import from drizzle-orm/pg-core
import { boolean, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
```

Add these columns inside the `user` pgTable definition, after the `role` column:

```ts
  phone: text('phone'),
  birthdate: text('birthdate'),
  startDate: text('start_date'),
  funFact: text('fun_fact'),
  agentProfileJSON: jsonb('agent_profile_json').$type<AgentProfile>(),
```

Add the import at the top of the file:

```ts
import type { AgentProfile } from '@/shared/entities/agents/schemas'
```

- [ ] **Step 2: Create agent profile entity schema**

Create `src/shared/entities/agents/schemas.ts`:

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

- [ ] **Step 3: Register new fields with better-auth**

In `src/shared/auth/server.ts`, add the new fields to `user.additionalFields`:

```ts
    additionalFields: {
      nickname: {
        type: 'string',
        input: false,
      },
      role: {
        type: [...userRoles] as const,
        defaultValue: 'user',
      },
      phone: {
        type: 'string',
        input: false,
      },
      birthdate: {
        type: 'string',
        input: false,
      },
      startDate: {
        type: 'string',
        input: false,
      },
      funFact: {
        type: 'string',
        input: false,
      },
    },
```

Note: `agentProfileJSON` is not registered with better-auth — it's managed directly via Drizzle in the tRPC router.

- [ ] **Step 4: Push schema changes**

Run: `pnpm db:push`

Confirm the migration adds the 5 new nullable columns.

- [ ] **Step 5: Verify types compile**

Run: `pnpm tsc --noEmit`

Expected: No errors. The `$type<AgentProfile>()` on the jsonb column provides type safety.

- [ ] **Step 6: Commit**

```bash
git add src/shared/db/schema/auth.ts src/shared/entities/agents/schemas.ts src/shared/auth/server.ts
git commit -m "feat(schema): add agent profile columns and JSONB entity schema"
```

---

## Task 2: Dashboard Steps & Nav Config

**Files:**
- Modify: `src/features/agent-dashboard/constants/dashboard-steps.ts`
- Create: `src/features/agent-dashboard/lib/get-sidebar-nav.ts`

- [ ] **Step 1: Expand dashboard steps**

Replace the contents of `src/features/agent-dashboard/constants/dashboard-steps.ts`:

```ts
export const dashboardSteps = [
  'customer-pipelines',
  'meetings',
  'edit-meeting',
  'proposals',
  'create-proposal',
  'edit-proposal',
  'showroom',
  'create-project',
  'edit-project',
  'dashboard',
  'settings',
  'intake',
  'team',
  'analytics',
] as const
```

No changes needed to `types/index.ts` or `lib/url-parsers.ts` — they derive from this const array.

- [ ] **Step 2: Create sidebar nav config function**

Create `src/features/agent-dashboard/lib/get-sidebar-nav.ts`:

```ts
import type { LucideIcon } from 'lucide-react'

import type { DashboardStep } from '@/features/agent-dashboard/types'
import type { UserRole } from '@/shared/types/enums'

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

export interface SidebarNavItem {
  step: DashboardStep
  icon: LucideIcon
  label: string
  enabled: boolean
}

export interface SidebarNavConfig {
  baseItems: readonly SidebarNavItem[]
  adminItems: readonly SidebarNavItem[]
  footerItems: readonly SidebarNavItem[]
}

export function getSidebarNav(userRole: UserRole): SidebarNavConfig {
  const baseItems: SidebarNavItem[] = [
    { step: 'dashboard', icon: LayoutDashboardIcon, label: 'Dashboard', enabled: false },
    { step: 'customer-pipelines', icon: GitBranchIcon, label: 'Pipelines', enabled: true },
    { step: 'meetings', icon: CalendarIcon, label: 'Meetings', enabled: true },
    { step: 'proposals', icon: FileTextIcon, label: 'Proposals', enabled: true },
    { step: 'showroom', icon: ImageIcon, label: 'Showroom', enabled: true },
  ]

  const adminItems: SidebarNavItem[] = userRole === 'super-admin'
    ? [
        { step: 'intake', icon: ClipboardListIcon, label: 'Intake Form', enabled: false },
        { step: 'team', icon: UsersIcon, label: 'Team', enabled: false },
        { step: 'analytics', icon: BarChart3Icon, label: 'Analytics', enabled: false },
      ]
    : []

  const footerItems: SidebarNavItem[] = [
    { step: 'settings', icon: SettingsIcon, label: 'Settings', enabled: true },
  ]

  return { baseItems, adminItems, footerItems }
}
```

- [ ] **Step 3: Verify types compile**

Run: `pnpm tsc --noEmit`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/agent-dashboard/constants/dashboard-steps.ts src/features/agent-dashboard/lib/get-sidebar-nav.ts
git commit -m "feat(dashboard): expand step types and add sidebar nav config function"
```

---

## Task 3: AppSidebar Component

**Files:**
- Create: `src/features/agent-dashboard/ui/components/app-sidebar.tsx`
- Create: `src/features/agent-dashboard/ui/components/sidebar-user-button.tsx`

- [ ] **Step 1: Create the sidebar user button**

Create `src/features/agent-dashboard/ui/components/sidebar-user-button.tsx`:

```ts
'use client'

import { ChevronsUpDownIcon, LogOutIcon, SettingsIcon } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/shared/components/ui/sidebar'

interface SidebarUserButtonProps {
  user: {
    name: string
    email: string
    image?: string | null
  }
  onSettingsClick: () => void
  onLogoutClick: () => void
}

export function SidebarUserButton({ user, onSettingsClick, onLogoutClick }: SidebarUserButtonProps) {
  const { isMobile } = useSidebar()

  const initials = user.name
    .split(' ')
    .map(n => n.charAt(0))
    .join('')
    .toUpperCase()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={user.name}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                <AvatarImage src={user.image ?? undefined} alt={user.name} />
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="size-8 rounded-lg">
                  <AvatarImage src={user.image ?? undefined} alt={user.name} />
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={onSettingsClick}>
                <SettingsIcon />
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogoutClick}>
              <LogOutIcon />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
```

- [ ] **Step 2: Create the AppSidebar component**

Create `src/features/agent-dashboard/ui/components/app-sidebar.tsx`:

```ts
'use client'

import type { SidebarNavItem } from '@/features/agent-dashboard/lib/get-sidebar-nav'
import type { BetterAuthUser } from '@/shared/auth/server'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo } from 'react'
import { useQueryState } from 'nuqs'

import { getSidebarNav } from '@/features/agent-dashboard/lib/get-sidebar-nav'
import { dashboardStepParser } from '@/features/agent-dashboard/lib/url-parsers'
import { SidebarUserButton } from '@/features/agent-dashboard/ui/components/sidebar-user-button'
import { signOut } from '@/shared/auth/client'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/shared/components/ui/sidebar'

interface AppSidebarProps {
  user: BetterAuthUser
}

export function AppSidebar({ user }: AppSidebarProps) {
  const [step, setStep] = useQueryState('step', dashboardStepParser)
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'

  const navConfig = useMemo(() => getSidebarNav(user.role), [user.role])

  function handleNavClick(item: SidebarNavItem) {
    if (item.enabled) {
      setStep(item.step)
    }
  }

  return (
    <Sidebar collapsible="icon" side="left" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Home">
              <Link href="/">
                {isCollapsed
                  ? (
                      <Image
                        src="/company/logo/logo-light.svg"
                        alt="Tri Pros"
                        width={24}
                        height={24}
                        className="dark:invert"
                      />
                    )
                  : (
                      <>
                        <Image
                          src="/company/logo/logo-light-right.svg"
                          alt="Tri Pros Remodeling"
                          width={140}
                          height={40}
                          className="dark:hidden"
                        />
                        <Image
                          src="/company/logo/logo-dark-right.svg"
                          alt="Tri Pros Remodeling"
                          width={140}
                          height={40}
                          className="hidden dark:block"
                        />
                      </>
                    )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navConfig.baseItems.map(item => (
                <SidebarMenuItem key={item.step}>
                  <SidebarMenuButton
                    tooltip={item.label}
                    isActive={step === item.step}
                    disabled={!item.enabled}
                    onClick={() => handleNavClick(item)}
                    className="gap-4"
                  >
                    <item.icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {navConfig.adminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navConfig.adminItems.map(item => (
                  <SidebarMenuItem key={item.step}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      isActive={step === item.step}
                      disabled={!item.enabled}
                      onClick={() => handleNavClick(item)}
                      className="gap-4"
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {navConfig.footerItems.map(item => (
            <SidebarMenuItem key={item.step}>
              <SidebarMenuButton
                tooltip={item.label}
                isActive={step === item.step}
                disabled={!item.enabled}
                onClick={() => handleNavClick(item)}
                className="gap-4"
              >
                <item.icon className="size-4 shrink-0" />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>

        <SidebarUserButton
          user={{
            name: user.name,
            email: user.email,
            image: user.image,
          }}
          onSettingsClick={() => setStep('settings')}
          onLogoutClick={() => signOut()}
        />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
```

- [ ] **Step 3: Verify types compile**

Run: `pnpm tsc --noEmit`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/agent-dashboard/ui/components/app-sidebar.tsx src/features/agent-dashboard/ui/components/sidebar-user-button.tsx
git commit -m "feat(dashboard): add AppSidebar and SidebarUserButton components"
```

---

## Task 4: Dashboard Layout Overhaul

**Files:**
- Modify: `src/app/(frontend)/dashboard/layout.tsx`
- Modify: `src/app/(frontend)/dashboard/page.tsx`
- Modify: `src/features/agent-dashboard/ui/views/dashboard-hub.tsx`
- Delete: `src/features/agent-dashboard/ui/components/dashboard-sidebar.tsx`
- Delete: `src/features/agent-dashboard/constants/sidebar-items.ts`

- [ ] **Step 1: Replace dashboard layout**

Replace the contents of `src/app/(frontend)/dashboard/layout.tsx`:

```tsx
import { Suspense } from 'react'

import { GlobalDialogs } from '@/shared/components/dialogs/modals/global-dialogs'
import { PwaInstallPrompt } from '@/shared/components/pwa-install-prompt'
import { SidebarInset, SidebarProvider } from '@/shared/components/ui/sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GlobalDialogs />
      <PwaInstallPrompt />
      <SidebarProvider defaultOpen>
        <SidebarInset
          className="min-h-dvh"
          style={{
            background: `radial-gradient(ellipse 80% 50% at 50% 0%, color-mix(in oklch, var(--primary) 35%, transparent), var(--background) 70%), var(--background)`,
          }}
        >
          <Suspense>
            {children}
          </Suspense>
        </SidebarInset>
      </SidebarProvider>
    </>
  )
}
```

Note: The `AppSidebar` is rendered inside `DashboardHub` (client component) because it needs the user session and query state. The `SidebarProvider` wraps from the layout so the context is available. We will move `AppSidebar` rendering to the layout in a later step once we confirm the session data flow.

- [ ] **Step 2: Update dashboard page to pass session**

Replace the contents of `src/app/(frontend)/dashboard/page.tsx`:

```tsx
import { DashboardHub } from '@/features/agent-dashboard/ui/views/dashboard-hub'
import { protectDashboardPage } from '@/shared/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const authState = await protectDashboardPage()
  return <DashboardHub authState={authState} />
}
```

- [ ] **Step 3: Update DashboardHub to use AppSidebar**

Replace the contents of `src/features/agent-dashboard/ui/views/dashboard-hub.tsx`:

```tsx
'use client'

import { AnimatePresence } from 'motion/react'
import { useQueryState } from 'nuqs'

import type { DashboardAuthState } from '@/shared/permissions/lib/protect-dashboard-page'

import { dashboardStepParser } from '@/features/agent-dashboard/lib/url-parsers'
import { AppSidebar } from '@/features/agent-dashboard/ui/components/app-sidebar'
import { CustomerPipelineView } from '@/features/customer-pipelines/ui/views'
import { MeetingsView } from '@/features/meetings/ui/views'
import { CreateNewProposalView, EditProposalView, PastProposalsView } from '@/features/proposal-flow/ui/views'
import { CreateProjectView, EditProjectView, PortfolioProjectsView } from '@/features/showroom/ui/views'
import { SignInGoogleButton } from '@/shared/components/buttons/auth/sign-in-google-button'
import { EmptyState } from '@/shared/components/states/empty-state'
import { ErrorState } from '@/shared/components/states/error-state'
import { SidebarTrigger } from '@/shared/components/ui/sidebar'
import { editProjectIdParser } from '@/shared/lib/url-parsers'

interface DashboardHubProps {
  authState: DashboardAuthState
}

export function DashboardHub({ authState }: DashboardHubProps) {
  const [step] = useQueryState('step', dashboardStepParser)
  const [editProjectId] = useQueryState('editProjectId', editProjectIdParser)

  if (authState.status === 'unauthenticated') {
    return (
      <div className="flex h-dvh w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <ErrorState
            title="Sign in to access the dashboard"
            description="You need to be signed in to view this page."
          />
          <SignInGoogleButton />
        </div>
      </div>
    )
  }

  return (
    <>
      <AppSidebar user={authState.session.user} />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 px-4 md:hidden">
          <SidebarTrigger />
        </header>
        <main className="relative flex-1 overflow-hidden px-4 pb-4 md:px-6 md:py-6">
          <AnimatePresence>
            {step === 'customer-pipelines' && <CustomerPipelineView key="customer-pipelines" />}
          </AnimatePresence>
          <AnimatePresence>
            {step === 'meetings' && <MeetingsView key="meetings" />}
          </AnimatePresence>
          <AnimatePresence>
            {step === 'proposals' && <PastProposalsView key="proposals" />}
          </AnimatePresence>
          <AnimatePresence>
            {step === 'create-proposal' && <CreateNewProposalView key="create-proposal" />}
          </AnimatePresence>
          <AnimatePresence>
            {step === 'edit-proposal' && <EditProposalView key="edit-proposal" />}
          </AnimatePresence>
          <AnimatePresence>
            {step === 'showroom' && <PortfolioProjectsView key="showroom" />}
          </AnimatePresence>
          <AnimatePresence>
            {step === 'create-project' && <CreateProjectView key="create-project" />}
          </AnimatePresence>
          <AnimatePresence>
            {step === 'edit-project' && editProjectId && (
              <EditProjectView key={`edit-project-${editProjectId}`} projectId={editProjectId} />
            )}
          </AnimatePresence>
          {step === 'settings' && authState.status === 'authenticated' && (
            <div key="settings" className="h-full overflow-y-auto">
              <EmptyState
                title="Settings"
                description="Agent profile & settings coming soon."
              />
            </div>
          )}
          {(step === 'dashboard' || step === 'intake' || step === 'team' || step === 'analytics') && (
            <EmptyState
              title="Coming Soon"
              description="This section is under construction."
            />
          )}
        </main>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Delete old sidebar files**

```bash
rm src/features/agent-dashboard/ui/components/dashboard-sidebar.tsx
rm src/features/agent-dashboard/constants/sidebar-items.ts
```

- [ ] **Step 5: Verify types compile and lint passes**

Run: `pnpm tsc --noEmit && pnpm lint`

Expected: No errors. If lint shows unused imports from deleted files, fix them.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(dashboard): replace layout with full-screen SidebarProvider + AppSidebar"
```

---

## Task 5: tRPC Router for Agent Settings

**Files:**
- Create: `src/trpc/routers/agent-settings.router.ts`
- Modify: `src/trpc/routers/app.ts`

- [ ] **Step 1: Create agent settings router**

Create `src/trpc/routers/agent-settings.router.ts`:

```ts
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { agentProfileSchema } from '@/shared/entities/agents/schemas'
import { db } from '@/shared/db'
import { user } from '@/shared/db/schema'
import { getPresignedUploadUrl } from '@/shared/services/r2/get-presigned-upload-url'
import { R2_BUCKETS, R2_PUBLIC_DOMAINS } from '@/shared/services/r2/buckets'
import { agentProcedure, createTRPCRouter } from '../init'

export const agentSettingsRouter = createTRPCRouter({
  getProfile: agentProcedure.query(async ({ ctx }) => {
    const [profile] = await db
      .select()
      .from(user)
      .where(eq(user.id, ctx.session.user.id))
      .limit(1)

    return profile ?? null
  }),

  updateProfile: agentProcedure
    .input(z.object({
      phone: z.string().nullish(),
      birthdate: z.string().nullish(),
      startDate: z.string().nullish(),
      funFact: z.string().nullish(),
      agentProfileJSON: agentProfileSchema.nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(user)
        .set({
          phone: input.phone,
          birthdate: input.birthdate,
          startDate: input.startDate,
          funFact: input.funFact,
          agentProfileJSON: input.agentProfileJSON,
        })
        .where(eq(user.id, ctx.session.user.id))
        .returning()

      return updated
    }),

  getHeadshotUploadUrl: agentProcedure
    .input(z.object({
      filename: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const pathKey = `agent-headshots/${ctx.session.user.id}/${Date.now()}-${input.filename}`

      const uploadUrl = await getPresignedUploadUrl({
        bucket: R2_BUCKETS.companyDocs,
        pathKey,
        mimeType: input.mimeType,
      })

      const publicDomain = R2_PUBLIC_DOMAINS[R2_BUCKETS.companyDocs]
      const publicUrl = `${publicDomain}/${pathKey}`

      return { uploadUrl, pathKey, publicUrl }
    }),
})
```

- [ ] **Step 2: Register router in app.ts**

In `src/trpc/routers/app.ts`, add the import and registration:

Add import:
```ts
import { agentSettingsRouter } from './agent-settings.router'
```

Add to the `createTRPCRouter` object:
```ts
  agentSettingsRouter,
```

- [ ] **Step 3: Verify types compile**

Run: `pnpm tsc --noEmit`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/trpc/routers/agent-settings.router.ts src/trpc/routers/app.ts
git commit -m "feat(trpc): add agentSettingsRouter with getProfile, updateProfile, getHeadshotUploadUrl"
```

---

## Task 6: Settings Feature — Constants, Schemas, Lib

**Files:**
- Create: `src/features/agent-settings/constants/languages.ts`
- Create: `src/features/agent-settings/constants/company-info.ts`
- Create: `src/features/agent-settings/lib/format-tenure.ts`
- Create: `src/features/agent-settings/schemas/profile-form.ts`
- Create: `src/features/agent-settings/types/index.ts`

- [ ] **Step 1: Create language options**

Create `src/features/agent-settings/constants/languages.ts`:

```ts
export const languageOptions = [
  'English',
  'Spanish',
  'Mandarin',
  'Cantonese',
  'Tagalog',
  'Vietnamese',
  'Korean',
  'Japanese',
  'Armenian',
  'Farsi',
  'Arabic',
  'Hindi',
  'French',
  'Portuguese',
  'Russian',
] as const
```

- [ ] **Step 2: Create company info constants**

Create `src/features/agent-settings/constants/company-info.ts`:

```ts
export const COMPANY_INFO = {
  name: 'Tri Pros Remodeling',
  license: 'CSLB #1234567',
  phone: '(555) 123-4567',
  email: 'info@triprosremodeling.com',
  website: 'https://triprosremodeling.com',
} as const

export const USEFUL_LINKS = [
  { label: 'Company Website', href: 'https://triprosremodeling.com', external: true },
  { label: 'Pipedrive CRM', href: 'https://app.pipedrive.com', external: true },
  { label: 'Monday.com', href: 'https://app.monday.com', external: true },
] as const
```

- [ ] **Step 3: Create tenure formatter**

Create `src/features/agent-settings/lib/format-tenure.ts`:

```ts
export function formatTenure(startDate: string | null | undefined): string | null {
  if (!startDate) {
    return null
  }

  const start = new Date(startDate)
  const now = new Date()
  const diffMs = now.getTime() - start.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 30) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''}`
  }

  const diffMonths = Math.floor(diffDays / 30)

  if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths !== 1 ? 's' : ''}`
  }

  const years = Math.floor(diffMonths / 12)
  const remainingMonths = diffMonths % 12

  if (remainingMonths === 0) {
    return `${years} year${years !== 1 ? 's' : ''}`
  }

  return `${years} year${years !== 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`
}
```

- [ ] **Step 4: Create form schemas**

Create `src/features/agent-settings/schemas/profile-form.ts`:

```ts
import { z } from 'zod'

import { agentProfileSchema } from '@/shared/entities/agents/schemas'

export const identityFormSchema = z.object({
  phone: z.string().optional(),
  birthdate: z.string().optional(),
  startDate: z.string().optional(),
  funFact: z.string().optional(),
})

export type IdentityFormValues = z.infer<typeof identityFormSchema>

export const brandFormSchema = agentProfileSchema.omit({
  headshotUrl: true,
  headshotCropData: true,
})

export type BrandFormValues = z.infer<typeof brandFormSchema>
```

- [ ] **Step 5: Create feature types**

Create `src/features/agent-settings/types/index.ts`:

```ts
import type { AppRouterOutputs } from '@/trpc/routers/app'

export type AgentSettingsProfile = NonNullable<AppRouterOutputs['agentSettingsRouter']['getProfile']>
```

- [ ] **Step 6: Verify types compile**

Run: `pnpm tsc --noEmit`

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/agent-settings/
git commit -m "feat(agent-settings): add constants, form schemas, types, and tenure formatter"
```

---

## Task 7: Settings View & Profile Header

**Files:**
- Create: `src/features/agent-settings/ui/views/settings-view.tsx`
- Create: `src/features/agent-settings/ui/components/profile-header-card.tsx`

- [ ] **Step 1: Create profile header card**

Create `src/features/agent-settings/ui/components/profile-header-card.tsx`:

```tsx
'use client'

import type { AgentSettingsProfile } from '@/features/agent-settings/types'

import { formatTenure } from '@/features/agent-settings/lib/format-tenure'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent } from '@/shared/components/ui/card'

interface ProfileHeaderCardProps {
  profile: AgentSettingsProfile
}

export function ProfileHeaderCard({ profile }: ProfileHeaderCardProps) {
  const initials = profile.name
    .split(' ')
    .map(n => n.charAt(0))
    .join('')
    .toUpperCase()

  const tenure = formatTenure(profile.startDate)
  const headshotUrl = (profile.agentProfileJSON as { headshotUrl?: string } | null)?.headshotUrl

  return (
    <Card>
      <CardContent className="flex items-center gap-6 pt-6">
        <Avatar className="size-20 rounded-xl">
          <AvatarImage src={headshotUrl ?? profile.image ?? undefined} alt={profile.name} />
          <AvatarFallback className="rounded-xl text-2xl">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold">{profile.name}</h2>
            <Badge variant="secondary" className="capitalize">{profile.role}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
          {tenure && (
            <p className="text-sm text-muted-foreground">
              At Tri Pros for {tenure}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Create settings view**

Create `src/features/agent-settings/ui/views/settings-view.tsx`:

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'

import { ProfileHeaderCard } from '@/features/agent-settings/ui/components/profile-header-card'
import { LoadingState } from '@/shared/components/states/loading-state'
import { useTRPC } from '@/trpc/helpers'

export function SettingsView() {
  const trpc = useTRPC()
  const { data: profile, isLoading } = useQuery(trpc.agentSettingsRouter.getProfile.queryOptions())

  if (isLoading) {
    return <LoadingState />
  }

  if (!profile) {
    return null
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 pb-8">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your profile, preferences, and account settings.</p>
        </div>
        <ProfileHeaderCard profile={profile} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire settings view into DashboardHub**

In `src/features/agent-dashboard/ui/views/dashboard-hub.tsx`, replace the temporary `EmptyState` for `settings` step:

Replace:
```tsx
          {step === 'settings' && authState.status === 'authenticated' && (
            <div key="settings" className="h-full overflow-y-auto">
              <EmptyState
                title="Settings"
                description="Agent profile & settings coming soon."
              />
            </div>
          )}
```

With:
```tsx
          {step === 'settings' && authState.status === 'authenticated' && (
            <SettingsView key="settings" />
          )}
```

Add the import at the top:
```ts
import { SettingsView } from '@/features/agent-settings/ui/views/settings-view'
```

- [ ] **Step 4: Verify types compile**

Run: `pnpm tsc --noEmit`

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/agent-settings/ui/ src/features/agent-dashboard/ui/views/dashboard-hub.tsx
git commit -m "feat(agent-settings): add SettingsView and ProfileHeaderCard"
```

---

## Task 8: Identity & Contact Section

**Files:**
- Create: `src/features/agent-settings/ui/components/identity-contact-section.tsx`

- [ ] **Step 1: Create identity contact section**

Create `src/features/agent-settings/ui/components/identity-contact-section.tsx`:

```tsx
'use client'

import type { AgentSettingsProfile } from '@/features/agent-settings/types'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { SaveIcon } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { type IdentityFormValues, identityFormSchema } from '@/features/agent-settings/schemas/profile-form'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { useTRPC } from '@/trpc/helpers'

interface IdentityContactSectionProps {
  profile: AgentSettingsProfile
}

export function IdentityContactSection({ profile }: IdentityContactSectionProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const form = useForm<IdentityFormValues>({
    resolver: zodResolver(identityFormSchema),
    defaultValues: {
      phone: profile.phone ?? '',
      birthdate: profile.birthdate ?? '',
      startDate: profile.startDate ?? '',
      funFact: profile.funFact ?? '',
    },
  })

  const updateMutation = useMutation(
    trpc.agentSettingsRouter.updateProfile.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.agentSettingsRouter.getProfile.queryKey() })
        toast.success('Profile updated')
      },
      onError: () => {
        toast.error('Failed to update profile')
      },
    }),
  )

  function onSubmit(values: IdentityFormValues) {
    updateMutation.mutate({
      phone: values.phone || null,
      birthdate: values.birthdate || null,
      startDate: values.startDate || null,
      funFact: values.funFact || null,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Identity & Contact</CardTitle>
        <CardDescription>Personal information and contact details.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="(555) 123-4567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="birthdate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Birthdate</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date at Tri Pros</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="funFact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fun Fact / Hobby</FormLabel>
                  <FormControl>
                    <Input placeholder="I restore vintage motorcycles on weekends" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" size="sm" disabled={updateMutation.isPending}>
              <SaveIcon className="size-4" />
              Save
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Add to SettingsView**

In `src/features/agent-settings/ui/views/settings-view.tsx`, add after `ProfileHeaderCard`:

Add import:
```ts
import { IdentityContactSection } from '@/features/agent-settings/ui/components/identity-contact-section'
```

Add after `<ProfileHeaderCard profile={profile} />`:
```tsx
        <div className="grid gap-6 lg:grid-cols-2">
          <IdentityContactSection profile={profile} />
        </div>
```

- [ ] **Step 3: Verify types compile**

Run: `pnpm tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/features/agent-settings/
git commit -m "feat(agent-settings): add IdentityContactSection with form"
```

---

## Task 9: Customer Brand Section

**Files:**
- Create: `src/features/agent-settings/ui/components/customer-brand-section.tsx`

- [ ] **Step 1: Create customer brand section**

Create `src/features/agent-settings/ui/components/customer-brand-section.tsx`:

```tsx
'use client'

import type { AgentProfile } from '@/shared/entities/agents/schemas'
import type { AgentSettingsProfile } from '@/features/agent-settings/types'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { SaveIcon } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { type BrandFormValues, brandFormSchema } from '@/features/agent-settings/schemas/profile-form'
import { languageOptions } from '@/features/agent-settings/constants/languages'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { useTRPC } from '@/trpc/helpers'

interface CustomerBrandSectionProps {
  profile: AgentSettingsProfile
}

export function CustomerBrandSection({ profile }: CustomerBrandSectionProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const agentProfile = profile.agentProfileJSON as AgentProfile | null

  const form = useForm<BrandFormValues>({
    resolver: zodResolver(brandFormSchema),
    defaultValues: {
      quote: agentProfile?.quote ?? '',
      bio: agentProfile?.bio ?? '',
      yearsOfExperience: agentProfile?.yearsOfExperience ?? undefined,
      tradeSpecialties: agentProfile?.tradeSpecialties ?? [],
      languagesSpoken: agentProfile?.languagesSpoken ?? [],
      certifications: agentProfile?.certifications ?? [],
    },
  })

  const updateMutation = useMutation(
    trpc.agentSettingsRouter.updateProfile.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.agentSettingsRouter.getProfile.queryKey() })
        toast.success('Brand profile updated')
      },
      onError: () => {
        toast.error('Failed to update brand profile')
      },
    }),
  )

  function onSubmit(values: BrandFormValues) {
    const existingProfile = (profile.agentProfileJSON as AgentProfile | null) ?? {}

    updateMutation.mutate({
      agentProfileJSON: {
        ...existingProfile,
        ...values,
      },
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer-Facing Brand</CardTitle>
        <CardDescription>This information appears on proposals sent to customers.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="quote"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Personal Quote / Tagline</FormLabel>
                  <FormControl>
                    <Input placeholder="Building trust, one home at a time." maxLength={200} {...field} />
                  </FormControl>
                  <FormDescription>Max 200 characters. Appears on your proposal header.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>My Story</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell customers about yourself, your background, and why you're passionate about remodeling..."
                      rows={5}
                      maxLength={1000}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Max 1000 characters.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="yearsOfExperience"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Years of Experience</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      placeholder="10"
                      {...field}
                      value={field.value ?? ''}
                      onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="languagesSpoken"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Languages Spoken</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {languageOptions.map(lang => {
                        const isSelected = field.value?.includes(lang) ?? false
                        return (
                          <Button
                            key={lang}
                            type="button"
                            variant={isSelected ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => {
                              const current = field.value ?? []
                              field.onChange(
                                isSelected
                                  ? current.filter(l => l !== lang)
                                  : [...current, lang],
                              )
                            }}
                          >
                            {lang}
                          </Button>
                        )
                      })}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="certifications"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Personal Certifications</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Type a certification and press Enter"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const input = e.currentTarget
                          const value = input.value.trim()
                          if (value && !(field.value ?? []).includes(value)) {
                            field.onChange([...(field.value ?? []), value])
                            input.value = ''
                          }
                        }
                      }}
                    />
                  </FormControl>
                  {(field.value ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(field.value ?? []).map(cert => (
                        <Button
                          key={cert}
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => field.onChange((field.value ?? []).filter(c => c !== cert))}
                        >
                          {cert} &times;
                        </Button>
                      ))}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" size="sm" disabled={updateMutation.isPending}>
              <SaveIcon className="size-4" />
              Save
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Add to SettingsView grid**

In `src/features/agent-settings/ui/views/settings-view.tsx`, add the import and component inside the grid:

Add import:
```ts
import { CustomerBrandSection } from '@/features/agent-settings/ui/components/customer-brand-section'
```

Add after `<IdentityContactSection profile={profile} />` (inside the grid div):
```tsx
          <CustomerBrandSection profile={profile} />
```

- [ ] **Step 3: Verify types compile**

Run: `pnpm tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/features/agent-settings/
git commit -m "feat(agent-settings): add CustomerBrandSection with quote, bio, languages, certs"
```

---

## Task 10: Headshot Upload

**Files:**
- Create: `src/features/agent-settings/ui/components/headshot-upload.tsx`

- [ ] **Step 1: Create headshot upload component**

Create `src/features/agent-settings/ui/components/headshot-upload.tsx`:

```tsx
'use client'

import type { AgentProfile } from '@/shared/entities/agents/schemas'
import type { AgentSettingsProfile } from '@/features/agent-settings/types'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CameraIcon, Loader2Icon } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { useTRPC } from '@/trpc/helpers'

interface HeadshotUploadProps {
  profile: AgentSettingsProfile
}

export function HeadshotUpload({ profile }: HeadshotUploadProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const agentProfile = profile.agentProfileJSON as AgentProfile | null
  const headshotUrl = agentProfile?.headshotUrl

  const initials = profile.name
    .split(' ')
    .map(n => n.charAt(0))
    .join('')
    .toUpperCase()

  const getUploadUrl = useMutation(trpc.agentSettingsRouter.getHeadshotUploadUrl.mutationOptions())
  const updateProfile = useMutation(trpc.agentSettingsRouter.updateProfile.mutationOptions())

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return
    }

    setIsUploading(true)
    try {
      const { uploadUrl, publicUrl } = await getUploadUrl.mutateAsync({
        filename: file.name,
        mimeType: file.type,
      })

      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })

      await updateProfile.mutateAsync({
        agentProfileJSON: {
          ...(agentProfile ?? {}),
          headshotUrl: publicUrl,
        },
      })

      queryClient.invalidateQueries({ queryKey: trpc.agentSettingsRouter.getProfile.queryKey() })
      toast.success('Headshot uploaded')
    }
    catch {
      toast.error('Failed to upload headshot')
    }
    finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Headshot</CardTitle>
        <CardDescription>Your photo for proposals and the app. Max 5MB.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="relative">
            <Avatar className="size-24 rounded-xl">
              <AvatarImage src={headshotUrl ?? profile.image ?? undefined} alt={profile.name} />
              <AvatarFallback className="rounded-xl text-2xl">{initials}</AvatarFallback>
            </Avatar>
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50">
                <Loader2Icon className="size-6 animate-spin text-white" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <CameraIcon className="size-4" />
              {headshotUrl ? 'Change Photo' : 'Upload Photo'}
            </Button>
            <p className="text-xs text-muted-foreground">JPG, PNG, or WebP. Square recommended.</p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Add to SettingsView**

In `src/features/agent-settings/ui/views/settings-view.tsx`, add import and place it after ProfileHeaderCard, before the grid:

Add import:
```ts
import { HeadshotUpload } from '@/features/agent-settings/ui/components/headshot-upload'
```

Add after `<ProfileHeaderCard profile={profile} />` and before the grid div:
```tsx
        <HeadshotUpload profile={profile} />
```

- [ ] **Step 3: Verify types compile**

Run: `pnpm tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/features/agent-settings/
git commit -m "feat(agent-settings): add HeadshotUpload with R2 presigned URL flow"
```

---

## Task 11: App Settings & Company Info & Admin Sections

**Files:**
- Create: `src/features/agent-settings/ui/components/app-settings-section.tsx`
- Create: `src/features/agent-settings/ui/components/company-info-section.tsx`
- Create: `src/features/agent-settings/ui/components/admin-section.tsx`

- [ ] **Step 1: Create app settings section**

Create `src/features/agent-settings/ui/components/app-settings-section.tsx`:

```tsx
'use client'

import { MoonIcon, SunIcon, SunMoonIcon } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Label } from '@/shared/components/ui/label'

export function AppSettingsSection() {
  const { theme, setTheme } = useTheme()

  return (
    <Card>
      <CardHeader>
        <CardTitle>App Settings</CardTitle>
        <CardDescription>Customize your dashboard experience.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Theme</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={theme === 'light' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTheme('light')}
            >
              <SunIcon className="size-4" />
              Light
            </Button>
            <Button
              type="button"
              variant={theme === 'dark' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTheme('dark')}
            >
              <MoonIcon className="size-4" />
              Dark
            </Button>
            <Button
              type="button"
              variant={theme === 'system' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTheme('system')}
            >
              <SunMoonIcon className="size-4" />
              System
            </Button>
          </div>
        </div>
        <div className="space-y-2 opacity-50">
          <Label>Notifications</Label>
          <p className="text-sm text-muted-foreground">Notification preferences coming soon.</p>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Create company info section**

Create `src/features/agent-settings/ui/components/company-info-section.tsx`:

```tsx
import { ExternalLinkIcon } from 'lucide-react'

import { COMPANY_INFO, USEFUL_LINKS } from '@/features/agent-settings/constants/company-info'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'

export function CompanyInfoSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Info</CardTitle>
        <CardDescription>Tri Pros Remodeling company details.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Company</span>
            <span className="font-medium">{COMPANY_INFO.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">License</span>
            <span className="font-medium">{COMPANY_INFO.license}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Phone</span>
            <span className="font-medium">{COMPANY_INFO.phone}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{COMPANY_INFO.email}</span>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Useful Links</p>
          <div className="flex flex-col gap-1.5">
            {USEFUL_LINKS.map(link => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLinkIcon className="size-3.5" />
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Create admin section**

Create `src/features/agent-settings/ui/components/admin-section.tsx`:

```tsx
import { ClipboardListIcon, UsersIcon } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'

interface AdminSectionProps {
  onNavigate: (step: string) => void
}

export function AdminSection({ onNavigate }: AdminSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin</CardTitle>
        <CardDescription>Super-admin tools and quick actions.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" disabled onClick={() => onNavigate('intake')}>
            <ClipboardListIcon className="size-4" />
            Intake Form
          </Button>
          <Button variant="outline" disabled onClick={() => onNavigate('team')}>
            <UsersIcon className="size-4" />
            Team Overview
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Wire all sections into SettingsView**

Update `src/features/agent-settings/ui/views/settings-view.tsx` to its final form:

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { useQueryState } from 'nuqs'

import { dashboardStepParser } from '@/features/agent-dashboard/lib/url-parsers'
import { AdminSection } from '@/features/agent-settings/ui/components/admin-section'
import { AppSettingsSection } from '@/features/agent-settings/ui/components/app-settings-section'
import { CompanyInfoSection } from '@/features/agent-settings/ui/components/company-info-section'
import { CustomerBrandSection } from '@/features/agent-settings/ui/components/customer-brand-section'
import { HeadshotUpload } from '@/features/agent-settings/ui/components/headshot-upload'
import { IdentityContactSection } from '@/features/agent-settings/ui/components/identity-contact-section'
import { ProfileHeaderCard } from '@/features/agent-settings/ui/components/profile-header-card'
import { LoadingState } from '@/shared/components/states/loading-state'
import { useTRPC } from '@/trpc/helpers'

export function SettingsView() {
  const trpc = useTRPC()
  const [, setStep] = useQueryState('step', dashboardStepParser)
  const { data: profile, isLoading } = useQuery(trpc.agentSettingsRouter.getProfile.queryOptions())

  if (isLoading) {
    return <LoadingState />
  }

  if (!profile) {
    return null
  }

  const isSuperAdmin = profile.role === 'super-admin'

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 pb-8">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your profile, preferences, and account settings.</p>
        </div>
        <ProfileHeaderCard profile={profile} />
        <HeadshotUpload profile={profile} />
        <div className="grid gap-6 lg:grid-cols-2">
          <IdentityContactSection profile={profile} />
          <AppSettingsSection />
          <CustomerBrandSection profile={profile} />
          <CompanyInfoSection />
        </div>
        {isSuperAdmin && <AdminSection onNavigate={setStep} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verify types compile and lint passes**

Run: `pnpm tsc --noEmit && pnpm lint`

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/agent-settings/
git commit -m "feat(agent-settings): add AppSettings, CompanyInfo, and AdminSection"
```

---

## Task 12: Final Verification & Cleanup

**Files:**
- All modified files

- [ ] **Step 1: Run full type check**

Run: `pnpm tsc --noEmit`

Expected: No errors.

- [ ] **Step 2: Run linter**

Run: `pnpm lint`

Expected: No errors. Fix any import ordering or formatting issues.

- [ ] **Step 3: Review the full diff**

Run: `git diff main --stat` and `git diff main` to review all changes.

Check for:
- No debug logs or console statements
- No leftover TODO comments
- No unused imports
- All deleted files are accounted for
- Import ordering follows project conventions

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore(agent-settings): lint fixes and cleanup"
```
