# Auth & Permissions with CASL — Design Spec

**Date:** 2026-03-19
**Scope:** Centralized permissions system using CASL, route protection, tRPC procedure hardening, client-side UI gating, and deprecation of legacy auth helpers.

---

## Overview

Replace scattered `checkIsInternalUser()` / `checkUserRole()` calls with a centralized CASL-based permissions system. One source of truth (`defineAbilitiesFor(user)`) powers:
- Server-side tRPC procedure guards
- Server-side page protection (dashboard)
- Client-side UI gating (show/hide buttons, nav items)

Token-based access (proposals shared via URL) sits alongside CASL as a parallel access path.

---

## 1. CASL Ability Definition

**File:** `src/shared/permissions/abilities.ts`

### Resources & Actions

```
Resources: Customer, Meeting, Proposal, Project, Dashboard, User
Actions:   create, read, update, delete, access, manage
```

- `manage` = CASL built-in meaning "all actions on all resources"
- `access` = custom action for route/feature gating (e.g., Dashboard)

### Permission Matrix

| Resource | super-admin | agent | homeowner | user (default) |
|----------|-------------|-------|-----------|----------------|
| All | manage | — | — | — |
| Customer | (via manage) | read, update | — | — |
| Meeting | (via manage) | read, create, update | — | — |
| Proposal | (via manage) | read, create, update | read (own) | — |
| Project | (via manage) | read, create, update | — | — |
| Dashboard | (via manage) | access | — | — |
| User | (via manage) | read | read (own) | read (own) |

Key decisions:
- **Agents cannot create customers** — that's super-admin (office) responsibility
- **Agents cannot delete anything** — only super-admin can
- **Homeowner role is future-proofing** — most homeowners today are unauthenticated visitors with no account. Minimal permissions defined now so the structure is ready for a customer portal later.
- **`user` (default role)** gets nearly nothing — just read own User record.

### "Own" Resource Conditions

For `read User` (homeowner/default): CASL condition `{ id: user.id }` — user can only read their own record.

**Note on homeowner Proposal access:** Proposals have no direct `customerId` FK — they link through `Meeting → Customer`. In practice, unauthenticated homeowners access proposals via token-based URLs (Section 5), not CASL. For authenticated homeowners (future customer portal), the CASL condition would need a join-based check or a denormalized `customerId` on proposals. For now, the homeowner `read Proposal` rule is defined without conditions — it exists to reserve the permission slot for future implementation. The token gate handles the current use case.

### Function Signature

```ts
function defineAbilitiesFor(user: { id: string; role: UserRole } | null): AppAbility
```

- `null` user → empty ability (can do nothing)
- Returns a CASL `Ability` instance used by both server and client
- **super-admin** is a single line: `can('manage', 'all')` — CASL's built-in shorthand meaning "every action on every resource", including future resources added later

---

## 2. Route Protection (Dashboard)

**No middleware.ts** — the dashboard's 3-state flow requires UI changes, not just redirects.

**File:** `src/shared/permissions/lib/protect-dashboard-page.ts`

### Dashboard Access Flow

```
1. No session → return { status: 'unauthenticated' }
   UI: logo + "Sign in with Google" only. Main content = <ErrorState> prompting sign-in.
   No redirect — user could be a logged-out agent.

2. Session exists, user is NOT internal → redirect('/')
   User doesn't belong in the dashboard.

3. Session exists, user IS internal → return { status: 'authenticated', session, ability }
   Full dashboard experience.
```

### Implementation

- Server-side helper called from dashboard page server components
- Uses `defineAbilitiesFor(user)` to check `can('access', 'Dashboard')`
- Returns a discriminated union so the client view can branch on status

### Dashboard Layout Changes

- Dashboard layout receives auth status from page
- `unauthenticated`: render only logo + sign-in button in nav, no action buttons
- `authenticated`: render full nav with all dashboard features

---

## 3. tRPC Procedure Hardening

**File:** `src/trpc/init.ts`

### Procedure Types

| Procedure | Purpose | Check |
|-----------|---------|-------|
| `baseProcedure` | Public endpoints | (unchanged) |
| `protectedProcedure` | Any authenticated user | Session exists, attaches `ability` to ctx |
| `agentProcedure` | Internal users only | Session + `can('access', 'Dashboard')`, attaches `ability` to ctx |

- Current `agentProcedure` logic (session-only check) becomes `protectedProcedure`
- New `agentProcedure` extends `protectedProcedure` with CASL role check
- Both attach `ability: AppAbility` to the tRPC context via `next({ ctx: { ...ctx, ability } })`
- Downstream routers access `ctx.ability` which is typed via tRPC's context narrowing — no separate interface needed, the procedure middleware narrows the type automatically

### Per-Router Granular Checks

Individual handlers guard specific actions:

```ts
// Example: customers.router.ts — create customer
if (ctx.ability.cannot('create', 'Customer')) {
  throw new TRPCError({ code: 'FORBIDDEN' })
}
```

The procedure handles "are you internal?" — the handler handles "can you do this specific thing?"

---

## 4. Client-Side CASL for UI Gating

### Files

- `src/shared/permissions/context.ts` — `AbilityContext` (React context)
- `src/shared/permissions/provider.tsx` — `AbilityProvider` (builds ability from session)
- `src/shared/permissions/hooks.ts` — `useAbility()` hook

### Provider Placement

Inside existing `<Providers>` component at `src/shared/components/providers/index.tsx`. Add `AbilityProvider` wrapping the inner tree (inside `TRPCReactProvider` so `useSession()` is available). Reads session via `useSession()`, calls `defineAbilitiesFor(user)`, provides ability via context. When session is null, provides empty ability (can do nothing).

### Usage in Components

```tsx
const ability = useAbility()

// Conditionally render
{ability.can('delete', 'Customer') && <DeleteButton />}

// Conditionally disable
<EditButton disabled={ability.cannot('update', 'Meeting')} />

// Nav items
{ability.can('access', 'Dashboard') && <DashboardNavItems />}
```

### Important

Client-side checks are UX only — they hide UI that the user can't use. Server-side tRPC checks are the security boundary. Both use the same `defineAbilitiesFor()` function, so they're always in sync.

---

## 5. Token Gate for Shareable Resources

**File:** `src/shared/permissions/lib/validate-share-token.ts`

### Purpose

Parallel access path alongside CASL for unauthenticated users who have a valid share token (e.g., homeowners viewing proposals via emailed link).

### Function Signature

```ts
validateShareToken(token: string, resourceType: 'proposal' | ...):
  Promise<{ valid: true; resourceId: string } | { valid: false }>
```

### Per-Page Pattern

```
1. Has ?token param?
   → validateShareToken(token, 'proposal')
   → Valid: fetch resource by ID, render
   → Invalid: 404

2. No token?
   → Check auth + CASL ability
   → can('read', 'Proposal')? → render
   → No auth or no permission? → redirect or error
```

### Extensibility

Future shareable pages (project galleries, meeting summaries):
1. Add `token` column to that table
2. Add resource type to `validateShareToken`
3. Follow same page-level pattern

Token access is NOT modeled in CASL — it's a sibling concern, keeping CASL clean for authenticated role-based access only.

### Token Storage & Validation

- Proposals already have a `token: text` column (plaintext, no expiry)
- Token comparison uses direct DB lookup (`WHERE token = ?`) — not timing-sensitive since the token is a lookup key, not a compared secret
- No expiry for now — proposals remain accessible via token indefinitely
- Future: if expiry is needed, add a `tokenExpiresAt` column and check in `validateShareToken`

---

## 6. Legacy Helper Deprecation

### Files to Remove

| File | Current Usage |
|------|---------------|
| `src/shared/auth/lib/is-internal-user.ts` | `checkIsInternalUser(role)` |
| `src/shared/permissions/lib/check-user-role.ts` | `checkUserRole(email)` |

### Files to Refactor

**React components** — replace old helpers with `useAbility()` hook:

| File | Current Pattern | New Pattern |
|------|----------------|-------------|
| `src/shared/components/navigation/popover-nav.tsx` | `checkIsInternalUser(role)` for nav items | `useAbility()` → `ability.can('access', 'Dashboard')` |
| `src/features/landing/ui/components/services/notion-refresh-button.tsx` | `checkIsInternalUser(role)` to show button | `useAbility()` → `ability.can('update', 'Project')` |
| `src/features/proposal-flow/ui/components/proposal/heading.tsx` | `checkIsInternalUser(role)` for customer link | `useAbility()` → `ability.can('read', 'Customer')` |

**Pure functions (not React)** — accept `AppAbility` as parameter, NOT `useAbility()`:

| File | Current Pattern | New Pattern |
|------|----------------|-------------|
| `src/shared/constants/nav-items/index.ts` | `generateNavItemsGroups({ userRole })` with `checkIsInternalUser(userRole)` | Change signature to `generateNavItemsGroups({ ability })`, use `ability.can('access', 'Dashboard')`. Callers: `site-navbar.tsx` (passes ability from `useAbility()`) |

**Role-string consumers** — replace email-based `checkUserRole()` with `session.user.role`:

| File | Current Pattern | New Pattern |
|------|----------------|-------------|
| `src/features/proposal-flow/ui/components/navbar/navbar.tsx` | `checkUserRole(email)` → role string → `generateProposalSteps(userRole)` | Read `session.user.role` directly. `generateProposalSteps` keeps its `UserRole` param — it filters steps by role, not by ability. |
| `src/features/proposal-flow/ui/components/proposal/index.tsx` | Same as above | Same fix — `session.user.role` instead of email-based derivation |

**Note:** `generateProposalSteps(userRole: UserRole)` remains role-based (not CASL) because it controls form step visibility based on role identity, not a permission check. The fix is just replacing the broken email-based role derivation with the actual persisted `session.user.role`.

---

## 7. New Dependency

```
@casl/ability  — core CASL library
```

No `@casl/react` — we use our own lightweight `useAbility()` hook + context instead.

---

## 8. Types

**File:** `src/shared/permissions/types.ts`

```ts
type AppActions = 'create' | 'read' | 'update' | 'delete' | 'access' | 'manage'
type AppSubjects = 'Customer' | 'Meeting' | 'Proposal' | 'Project' | 'Dashboard' | 'User' | 'all'
type AppAbility = Ability<[AppActions, AppSubjects]>
```

---

## 9. File Structure

```
src/shared/permissions/
├── abilities.ts                    # defineAbilitiesFor(user) — single source of truth
├── context.ts                      # AbilityContext (React context)
├── provider.tsx                    # AbilityProvider (session → ability)
├── hooks.ts                        # useAbility()
├── types.ts                        # AppAbility, AppActions, AppSubjects
├── lib/
│   ├── protect-dashboard-page.ts   # Server-side dashboard page guard
│   └── validate-share-token.ts     # Token-based access for shareable resources
```

### Modified Files

| File | Change |
|------|--------|
| `src/trpc/init.ts` | Add `protectedProcedure`, rewrite `agentProcedure` with CASL, attach ability to ctx |
| `src/shared/components/providers/index.tsx` | Wrap with `AbilityProvider` |
| Dashboard page server components | Call `protectDashboardPage()` |
| Dashboard layout | Conditionally render nav based on auth status |
| 6 files using old helpers | Replace with `useAbility()` / `ability.can()` / `session.user.role` (see Section 6 for per-file details) |

### Deleted Files

| File | Reason |
|------|--------|
| `src/shared/auth/lib/is-internal-user.ts` | Replaced by CASL abilities |
| `src/shared/permissions/lib/check-user-role.ts` | Replaced by CASL abilities |
