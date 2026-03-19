# Auth & Permissions CASL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace scattered auth helpers with a centralized CASL-based permissions system powering tRPC guards, route protection, and client-side UI gating.

**Architecture:** Single `defineAbilitiesFor(user)` function defines all permissions. Used server-side in tRPC procedures and page guards, client-side via React context/hook. Token-based access for shareable resources sits alongside CASL as a parallel path.

**Tech Stack:** @casl/ability, better-auth, tRPC, React context, Next.js 15 App Router

**Spec:** `docs/superpowers/specs/2026-03-19-auth-permissions-casl-design.md`

---

### Task 1: Install @casl/ability and create types

**Files:**
- Create: `src/shared/permissions/types.ts`

- [ ] **Step 1: Install the dependency**

```bash
pnpm add @casl/ability
```

- [ ] **Step 2: Create the types file**

Create `src/shared/permissions/types.ts`:

```ts
// ─── CASL Permission Types ──────────────────────────────────────────────────
// These types define the shape of our permission system.
// AppAbility is the main type used everywhere — it's a CASL Ability
// parameterized with our specific actions and subjects.

import type { MongoAbility } from '@casl/ability'

// Actions a user can perform.
// 'manage' is CASL's built-in wildcard — means "all actions".
// 'access' is our custom action for route/feature gating (e.g., Dashboard).
export type AppActions = 'create' | 'read' | 'update' | 'delete' | 'access' | 'manage'

// Resources (subjects) that actions apply to.
// 'all' is CASL's built-in wildcard — means "all subjects".
// These map to your business entities, NOT database tables.
export type AppSubjects = 'Customer' | 'Meeting' | 'Proposal' | 'Project' | 'Dashboard' | 'User' | 'all'

// The main ability type used throughout the app.
// MongoAbility is CASL's default ability class — named "Mongo" for historical
// reasons but works with any backend. It's just the standard CASL ability.
export type AppAbility = MongoAbility<[AppActions, AppSubjects]>
```

- [ ] **Step 3: Verify lint passes**

```bash
pnpm lint
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/permissions/types.ts package.json pnpm-lock.yaml
git commit -m "feat(permissions): install @casl/ability and define permission types"
```

---

### Task 2: Create the ability definition (single source of truth)

**Files:**
- Create: `src/shared/permissions/abilities.ts`

- [ ] **Step 1: Create the abilities file**

Create `src/shared/permissions/abilities.ts`:

```ts
// ─── CASL Ability Definitions ───────────────────────────────────────────────
// This is THE single source of truth for permissions in the app.
// Both server (tRPC procedures) and client (React components) import this
// same function, so permissions are always in sync.
//
// HOW TO READ THIS:
// - Each role gets a block of `can(action, subject)` calls
// - `can('manage', 'all')` = can do everything (super-admin shorthand)
// - Conditions like `{ id: user.id }` restrict to "own" resources
//
// HOW TO EXTEND:
// - New resource? Add to AppSubjects in types.ts, add rules here
// - New role? Add a new case block below
// - New action on existing resource? Add a `can()` line to the role

import type { UserRole } from '@/shared/types/enums'
import type { AppAbility } from './types'
import { AbilityBuilder, createMongoAbility } from '@casl/ability'

// The user shape we need for permission decisions.
// Intentionally minimal — only id and role. If you need more fields
// for conditions (e.g., departmentId), add them here.
interface PermissionUser {
  id: string
  role: UserRole
}

export function defineAbilitiesFor(user: PermissionUser | null): AppAbility {
  // AbilityBuilder provides `can` and `cannot` helpers for defining rules.
  // The generic parameter tells CASL our action/subject types.
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility)

  if (!user) {
    // No user = no permissions. The returned ability will answer
    // `can(anything)` with false. This is used for unauthenticated visitors.
    return build()
  }

  switch (user.role) {
    // ── super-admin ───────────────────────────────────────────────────────
    // One line grants ALL actions on ALL resources — current and future.
    // When you add a new resource, super-admin automatically has access.
    case 'super-admin':
      can('manage', 'all')
      break

    // ── agent ─────────────────────────────────────────────────────────────
    // Explicit per-resource permissions. No delete on anything.
    // Cannot create customers (that's office/super-admin responsibility).
    case 'agent':
      can('access', 'Dashboard')

      can('read', 'Customer')
      can('update', 'Customer')
      // Note: no can('create', 'Customer') — intentional

      can('read', 'Meeting')
      can('create', 'Meeting')
      can('update', 'Meeting')

      can('read', 'Proposal')
      can('create', 'Proposal')
      can('update', 'Proposal')

      can('read', 'Project')
      can('create', 'Project')
      can('update', 'Project')

      can('read', 'User')
      break

    // ── homeowner ─────────────────────────────────────────────────────────
    // Future-proofing for customer portal. Most homeowners today are
    // unauthenticated and use token-based access (see validate-share-token.ts).
    // These rules are for authenticated homeowners only.
    //
    // Note: Proposal read has no condition yet because proposals link through
    // Meeting → Customer, not directly to user. The token gate handles the
    // current use case. When we build the customer portal, we'll either add
    // a condition here or use a join-based check.
    case 'homeowner':
      can('read', 'Proposal')
      can('read', 'User', { id: user.id })
      break

    // ── user (default role) ───────────────────────────────────────────────
    // Minimal permissions — can only read their own user record.
    case 'user':
      can('read', 'User', { id: user.id })
      break
  }

  return build()
}
```

- [ ] **Step 2: Verify lint passes**

```bash
pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/permissions/abilities.ts
git commit -m "feat(permissions): add CASL ability definitions for all roles"
```

---

### Task 3: Create React context, provider, and hook

**Files:**
- Create: `src/shared/permissions/context.ts`
- Create: `src/shared/permissions/provider.tsx`
- Create: `src/shared/permissions/hooks.ts`
- Modify: `src/shared/components/providers/index.tsx`

- [ ] **Step 1: Create the context**

Create `src/shared/permissions/context.ts`:

```ts
// ─── Ability React Context ──────────────────────────────────────────────────
// Holds the CASL ability instance for the current user.
// Consumed via the useAbility() hook (see hooks.ts).

import type { AppAbility } from './types'
import { createContext } from 'react'
import { createMongoAbility } from '@casl/ability'

// Default: an empty ability that denies everything.
// This is what components see before the provider mounts or when
// there is no authenticated user.
export const AbilityContext = createContext<AppAbility>(createMongoAbility())
```

- [ ] **Step 2: Create the hook**

Create `src/shared/permissions/hooks.ts`:

```ts
// ─── useAbility Hook ────────────────────────────────────────────────────────
// Use this in any client component to check permissions:
//
//   const ability = useAbility()
//   ability.can('delete', 'Customer')   // true/false
//   ability.cannot('update', 'Meeting') // true/false
//
// The ability updates automatically when the user's session changes.

import type { AppAbility } from './types'
import { useContext } from 'react'
import { AbilityContext } from './context'

export function useAbility(): AppAbility {
  return useContext(AbilityContext)
}
```

- [ ] **Step 3: Create the provider**

Create `src/shared/permissions/provider.tsx`:

```ts
'use client'

// ─── AbilityProvider ────────────────────────────────────────────────────────
// Reads the current session and builds a CASL ability from it.
// Wraps the app so any component can call useAbility().
//
// How it works:
// 1. useSession() gives us the current user (or null)
// 2. defineAbilitiesFor() converts user → CASL ability
// 3. useMemo ensures we only rebuild when the user changes
// 4. AbilityContext.Provider makes it available to all children

import { useMemo } from 'react'
import { useSession } from '@/shared/auth/client'
import { defineAbilitiesFor } from './abilities'
import { AbilityContext } from './context'

export function AbilityProvider({ children }: { children: React.ReactNode }) {
  const session = useSession()
  const user = session.data?.user ?? null

  // Rebuild ability when user identity or role changes.
  // useMemo prevents unnecessary rebuilds on every render.
  const ability = useMemo(
    () => defineAbilitiesFor(user ? { id: user.id, role: user.role } : null),
    [user?.id, user?.role],
  )

  return (
    <AbilityContext.Provider value={ability}>
      {children}
    </AbilityContext.Provider>
  )
}
```

- [ ] **Step 4: Wire into the Providers component**

Modify `src/shared/components/providers/index.tsx` — add `AbilityProvider` inside `TRPCReactProvider` (so `useSession()` works):

Place `AbilityProvider` inside `TRPCReactProvider` wrapping `NuqsProvider` and everything inside. This ensures `AbilityProvider` is in the tree before any component that calls `useAbility()`.

```ts
'use client'

import { AbilityProvider } from '@/shared/permissions/provider'
import { NuqsProvider } from './nuqs-adapter'
import { ThemeProvider } from './theme-provider'
import { ToasterProvider } from './toaster-provider'
import { TooltipProvider } from './tooltip-provider'
import { TRPCReactProvider } from './trpc-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCReactProvider>
      <AbilityProvider>
        <NuqsProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <TooltipProvider>
              {children}
            </TooltipProvider>
            <ToasterProvider />
          </ThemeProvider>
        </NuqsProvider>
      </AbilityProvider>
    </TRPCReactProvider>
  )
}
```

- [ ] **Step 5: Verify lint passes**

```bash
pnpm lint
```

- [ ] **Step 6: Commit**

```bash
git add src/shared/permissions/context.ts src/shared/permissions/hooks.ts src/shared/permissions/provider.tsx src/shared/components/providers/index.tsx
git commit -m "feat(permissions): add AbilityProvider, context, and useAbility hook"
```

---

### Task 4: Harden tRPC procedures

**Files:**
- Modify: `src/trpc/init.ts`

- [ ] **Step 1: Rewrite init.ts with protectedProcedure and agentProcedure**

Replace the existing `agentProcedure` in `src/trpc/init.ts`. The full file should become:

```ts
import type { AppAbility } from '@/shared/permissions/types'
import type { BetterAuthSession } from '@/shared/auth/server'
import { initTRPC, TRPCError } from '@trpc/server'
import { headers as getHeaders } from 'next/headers'
import { cache } from 'react'
import superjson from 'superjson'
import { ZodError } from 'zod'
import { auth } from '@/shared/auth/server'
import { defineAbilitiesFor } from '@/shared/permissions/abilities'

export interface CoreTRPCContext {
  session: BetterAuthSession | null
}

export interface HTTPTRPCContext extends CoreTRPCContext {
  req?: Request
  resHeaders: Headers
}

export const createHTTPTRPCContext = cache(async (ctx: { req?: Request, resHeaders: Headers }): Promise<HTTPTRPCContext> => {
  const reqHeaders = await getHeaders()

  const session = await auth.api.getSession({
    headers: reqHeaders,
  })

  return {
    session,
    req: ctx.req,
    resHeaders: ctx.resHeaders,
  }
})

const t = initTRPC.context<HTTPTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const createTRPCRouter = t.router
export const createCallerFactory = t.createCallerFactory
export const baseProcedure = t.procedure

// ── protectedProcedure ────────────────────────────────────────────────────
// Any authenticated user. Use for endpoints that homeowners/default users
// might need in the future (e.g., viewing their own proposal).
// Attaches CASL ability to context so downstream handlers can do
// granular checks like `ctx.ability.can('read', 'Proposal')`.
export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be signed in to perform this action',
    })
  }

  const ability = defineAbilitiesFor({
    id: ctx.session.user.id,
    role: ctx.session.user.role,
  })

  return await next({
    ctx: { ...ctx, session: ctx.session, ability },
  })
})

// ── agentProcedure ────────────────────────────────────────────────────────
// Internal users only (agent, super-admin). This is the main guard for
// dashboard/CRM endpoints. Extends protectedProcedure, so session and
// ability are already on ctx.
//
// The CASL check `can('access', 'Dashboard')` is equivalent to checking
// if the user is agent or super-admin, but uses the centralized permission
// system instead of hardcoded role checks.
export const agentProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.ability.cannot('access', 'Dashboard')) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this resource',
    })
  }

  return await next({ ctx })
})
```

- [ ] **Step 2: Verify lint passes and build succeeds**

```bash
pnpm lint && pnpm build
```

Build will confirm all existing routers using `agentProcedure` still compile — the exported name and context shape are compatible (session is still non-null, ability is added).

- [ ] **Step 3: Commit**

```bash
git add src/trpc/init.ts
git commit -m "feat(permissions): harden tRPC with CASL-based protectedProcedure and agentProcedure"
```

---

### Task 5: Create token gate utility

**Files:**
- Create: `src/shared/permissions/lib/validate-share-token.ts`

- [ ] **Step 1: Create the token validation utility**

Create `src/shared/permissions/lib/validate-share-token.ts`:

```ts
// ─── Token Gate for Shareable Resources ─────────────────────────────────────
// This is a PARALLEL access path alongside CASL. It handles unauthenticated
// users who have a valid share token (e.g., homeowners viewing proposals
// via an emailed link with ?token=xxx).
//
// CASL handles: "does this authenticated user have permission?"
// Token gate handles: "does this URL token grant access to a resource?"
//
// They are siblings, not parent-child. A page checks one or the other:
//   1. Has ?token → validate here → render if valid
//   2. No token → check auth + CASL → render if permitted
//
// HOW TO ADD A NEW SHAREABLE RESOURCE:
// 1. Add the resource type to the ShareableResourceType union below
// 2. Add a case to the switch in validateShareToken
// 3. Use the same page-level pattern (token first, then CASL fallback)

import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { proposals } from '@/shared/db/schema'

type ShareableResourceType = 'proposal'

type TokenResult =
  | { valid: true, resourceId: string }
  | { valid: false }

export async function validateShareToken(
  token: string,
  resourceType: ShareableResourceType,
): Promise<TokenResult> {
  switch (resourceType) {
    case 'proposal': {
      const result = await db
        .select({ id: proposals.id })
        .from(proposals)
        .where(eq(proposals.token, token))
        .limit(1)

      if (result.length === 0) {
        return { valid: false }
      }

      return { valid: true, resourceId: result[0].id }
    }

    default:
      return { valid: false }
  }
}
```

- [ ] **Step 2: Verify lint passes**

```bash
pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/permissions/lib/validate-share-token.ts
git commit -m "feat(permissions): add token gate utility for shareable resources"
```

---

### Task 6: Create dashboard page protection helper

**Files:**
- Create: `src/shared/permissions/lib/protect-dashboard-page.ts`

- [ ] **Step 1: Create the helper**

Create `src/shared/permissions/lib/protect-dashboard-page.ts`:

```ts
// ─── Dashboard Page Protection ──────────────────────────────────────────────
// Server-side helper for dashboard pages. Call this from the page's
// server component to determine what the client view should render.
//
// Returns a discriminated union:
//   { status: 'unauthenticated' }       → show sign-in prompt, no redirect
//   { status: 'authenticated', ... }    → full dashboard
//
// If the user is authenticated but NOT internal, this redirects to '/'
// (they don't belong in the dashboard).
//
// USAGE in a dashboard page server component:
//   const authState = await protectDashboardPage()
//   return <DashboardView authState={authState} />

import type { AppAbility } from '../types'
import type { BetterAuthSession } from '@/shared/auth/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/shared/auth/server'
import { defineAbilitiesFor } from '../abilities'

export type DashboardAuthState =
  | { status: 'unauthenticated' }
  | { status: 'authenticated', session: BetterAuthSession, ability: AppAbility }

export async function protectDashboardPage(): Promise<DashboardAuthState> {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders })

  // State 1: No session — could be a logged-out agent. Don't redirect,
  // let the UI show a sign-in prompt.
  if (!session) {
    return { status: 'unauthenticated' }
  }

  // State 2: Authenticated but not internal — redirect home.
  const ability = defineAbilitiesFor({
    id: session.user.id,
    role: session.user.role,
  })

  if (ability.cannot('access', 'Dashboard')) {
    redirect('/')
  }

  // State 3: Internal user — proceed with full dashboard.
  // Return ability so the client view can do granular permission checks
  // without rebuilding it.
  return { status: 'authenticated', session, ability }
}
```

- [ ] **Step 2: Verify lint passes**

```bash
pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/permissions/lib/protect-dashboard-page.ts
git commit -m "feat(permissions): add server-side dashboard page protection helper"
```

---

### Task 7: Wire protectDashboardPage into the dashboard

**Files:**
- Modify: `src/app/(frontend)/dashboard/page.tsx`

- [ ] **Step 1: Add protectDashboardPage to the dashboard page**

The dashboard page is a server component that currently just renders `<DashboardHub />`. Add the protection call and pass auth state down:

Modify `src/app/(frontend)/dashboard/page.tsx`:

```ts
import type { DashboardAuthState } from '@/shared/permissions/lib/protect-dashboard-page'
import { protectDashboardPage } from '@/shared/permissions/lib/protect-dashboard-page'
import { DashboardHub } from '@/features/agent-dashboard/ui/views/dashboard-hub'

export default async function DashboardPage() {
  const authState = await protectDashboardPage()
  return <DashboardHub authState={authState} />
}
```

Note: `DashboardHub` will need to accept `authState` as a prop and handle the `unauthenticated` case (show `<ErrorState>` with sign-in prompt instead of the normal dashboard content). The exact implementation of `DashboardHub`'s conditional rendering depends on its current structure — the implementer should:

1. Add `authState: DashboardAuthState` to `DashboardHub`'s props
2. When `authState.status === 'unauthenticated'`: render an `<ErrorState>` with a `<SignInGoogleButton />`
3. When `authState.status === 'authenticated'`: render the full dashboard as before

The dashboard layout (`src/app/(frontend)/dashboard/layout.tsx`) does NOT need changes for now — the layout provides the visual shell (background, container), and the page/view handles the content branching. Nav item visibility is already handled by `useAbility()` via the popover nav refactor in Task 8.

- [ ] **Step 2: Verify lint passes**

```bash
pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(frontend)/dashboard/page.tsx"
git commit -m "feat(permissions): wire protectDashboardPage into dashboard page"
```

---

### Task 8: Refactor legacy helpers — React components

**Files:**
- Modify: `src/shared/components/navigation/popover-nav.tsx`
- Modify: `src/features/landing/ui/components/services/notion-refresh-button.tsx`
- Modify: `src/features/proposal-flow/ui/components/proposal/heading.tsx`

- [ ] **Step 1: Refactor popover-nav.tsx**

In `src/shared/components/navigation/popover-nav.tsx`:

1. Remove import: `import { checkIsInternalUser } from '@/shared/auth/lib/is-internal-user'`
2. Add import: `import { useAbility } from '@/shared/permissions/hooks'`
3. Replace `const isInternalUser = checkIsInternalUser(sessionQuery.data?.user?.role)` with `const ability = useAbility()` and `const isInternalUser = ability.can('access', 'Dashboard')`

- [ ] **Step 2: Refactor notion-refresh-button.tsx**

In `src/features/landing/ui/components/services/notion-refresh-button.tsx`:

1. Remove import: `import { checkIsInternalUser } from '@/shared/auth/lib/is-internal-user'`
2. Add import: `import { useAbility } from '@/shared/permissions/hooks'`
3. Replace `const isInternal = checkIsInternalUser(session.data?.user?.role)` with `const ability = useAbility()` and change `if (!isInternal)` to `if (ability.cannot('update', 'Project'))`

- [ ] **Step 3: Refactor proposal/heading.tsx**

In `src/features/proposal-flow/ui/components/proposal/heading.tsx`:

1. Remove import: `import { checkIsInternalUser } from '@/shared/auth/lib/is-internal-user'`
2. Add import: `import { useAbility } from '@/shared/permissions/hooks'`
3. Replace `{checkIsInternalUser(role) && proposal.data.customer?.id && (` with declaring `const ability = useAbility()` and using `{ability.can('read', 'Customer') && proposal.data.customer?.id && (`

- [ ] **Step 4: Verify lint passes**

```bash
pnpm lint
```

- [ ] **Step 5: Commit**

```bash
git add "src/shared/components/navigation/popover-nav.tsx" "src/features/landing/ui/components/services/notion-refresh-button.tsx" "src/features/proposal-flow/ui/components/proposal/heading.tsx"
git commit -m "refactor(permissions): replace checkIsInternalUser with useAbility in React components"
```

---

### Task 9: Refactor legacy helpers — pure functions and role-string consumers

**Files:**
- Modify: `src/shared/constants/nav-items/index.ts`
- Modify: `src/shared/components/navigation/site-navbar.tsx`
- Modify: `src/features/proposal-flow/ui/components/navbar/navbar.tsx`
- Modify: `src/features/proposal-flow/ui/components/proposal/index.tsx`

- [ ] **Step 1: Refactor nav-items/index.ts**

In `src/shared/constants/nav-items/index.ts`:

1. Remove import: `import type { UserRole } from '@/shared/types/enums'` and `import { checkIsInternalUser } from '@/shared/auth/lib/is-internal-user'`
2. Add import: `import type { AppAbility } from '@/shared/permissions/types'`
3. Change `Options` interface from `{ userRole?: UserRole }` to `{ ability: AppAbility }`
4. Change function signature from `generateNavItemsGroups({ userRole }: Options)` to `generateNavItemsGroups({ ability }: Options)`
5. Replace `if (checkIsInternalUser(userRole))` with `if (ability.can('access', 'Dashboard'))`

- [ ] **Step 2: Update site-navbar.tsx caller**

In `src/shared/components/navigation/site-navbar.tsx`, find:
```ts
const items = generateNavItemsGroups({ userRole: session?.user?.role })
```
Replace with:
```ts
const items = generateNavItemsGroups({ ability })
```
And ensure `ability` is available — add `import { useAbility } from '@/shared/permissions/hooks'` and `const ability = useAbility()` at the component level. Also update the `useCallback` dependency array from `[session]` to `[ability]` since `session` is no longer referenced inside the callback.

- [ ] **Step 3: Refactor proposal-flow navbar.tsx**

In `src/features/proposal-flow/ui/components/navbar/navbar.tsx`:

1. Remove import: `import { checkUserRole } from '@/shared/permissions/lib/check-user-role'`
2. Replace `const userRole = checkUserRole(sessionQuery.data?.user.email || '')` with `const userRole = sessionQuery.data?.user?.role ?? 'user'`
3. Keep `generateProposalSteps(userRole)` as-is — it correctly uses role, not ability.

- [ ] **Step 4: Refactor proposal/index.tsx**

In `src/features/proposal-flow/ui/components/proposal/index.tsx`:

1. Remove import: `import { checkUserRole } from '@/shared/permissions/lib/check-user-role'`
2. Replace `const userRole = checkUserRole(sessionQuery.data?.user.email || '')` with `const userRole = sessionQuery.data?.user?.role ?? 'user'`

- [ ] **Step 5: Verify lint passes**

```bash
pnpm lint
```

- [ ] **Step 6: Commit**

```bash
git add "src/shared/constants/nav-items/index.ts" "src/shared/components/navigation/site-navbar.tsx" "src/features/proposal-flow/ui/components/navbar/navbar.tsx" "src/features/proposal-flow/ui/components/proposal/index.tsx"
git commit -m "refactor(permissions): replace checkUserRole/checkIsInternalUser in pure functions and role consumers"
```

---

### Task 10: Delete legacy helper files

**Files:**
- Delete: `src/shared/auth/lib/is-internal-user.ts`
- Delete: `src/shared/permissions/lib/check-user-role.ts`

- [ ] **Step 1: Verify no remaining imports**

```bash
# Search for any remaining references — should return 0 results
rg "checkIsInternalUser|check-user-role|is-internal-user" src/ -g "*.ts" -g "*.tsx"
```

If any results remain, fix them first before proceeding.

- [ ] **Step 2: Delete the files**

```bash
rm src/shared/auth/lib/is-internal-user.ts
rm src/shared/permissions/lib/check-user-role.ts
```

- [ ] **Step 3: Verify build succeeds**

```bash
pnpm lint && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "chore(permissions): remove deprecated checkIsInternalUser and checkUserRole helpers"
```

---

### Task 11: Full build verification

- [ ] **Step 1: Run lint**

```bash
pnpm lint
```

- [ ] **Step 2: Run build**

```bash
pnpm build
```

- [ ] **Step 3: Manual smoke test**

Start dev server and verify:
1. Visit `/dashboard` while logged out → should show sign-in prompt (no redirect)
2. Visit `/dashboard` as an agent → full dashboard
3. Open the popover nav → internal nav items visible for agents
4. Visit a proposal page with `?token=...` → should render (token gate)
5. Notion refresh button visible only for internal users on services pages
