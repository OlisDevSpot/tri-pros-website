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

import type { AppAbility } from './types'

import type { UserRole } from '@/shared/types/enums'
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
      can('update', 'Customer', ['customerProfileJSON', 'propertyProfileJSON', 'financialProfileJSON'])
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

      // Agents can only navigate fresh + projects pipelines.
      // Leads, rehash, dead are super-admin only (managed via 'manage' on 'CustomerPipeline').
      can('read', 'CustomerPipeline')

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
    //
    // Note on "own record" enforcement: CASL field conditions require subject
    // type objects (not plain strings). Since AppSubjects uses plain strings,
    // the { id } restriction is enforced at the DAL layer, not here.
    case 'homeowner':
      can('read', 'Proposal')
      can('read', 'User')
      break

    // ── user (default role) ───────────────────────────────────────────────
    // Minimal permissions — can only read their own user record.
    // "Own record" enforcement happens at the DAL layer (see note above).
    case 'user':
      can('read', 'User')
      break
  }

  return build()
}
