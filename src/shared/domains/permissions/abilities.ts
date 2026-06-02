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
// - New entity? Add its identity constant at `entities/<entity>/lib/constants.ts`,
//   import it below, and add it to ENTITY_NAMES.
// - New non-entity subject (feature/route gate)? Add it to AppSubject in types.ts.
// - New role? Add a new case block below.
// - New action on existing subject? Add a `can()` line to the role.

import type { AppAbility } from './types'

import type { UserRole } from '@/shared/constants/enums'

import { AbilityBuilder, createMongoAbility } from '@casl/ability'

// Per-entity identity constants colocated with the entity. The derived
// `EntityName` union is the entity portion of `AppSubject` — every entity
// here is automatically permittable. Adding a new entity is one import +
// one line in ENTITY_NAMES.
import { ACTIVITY } from '@/shared/entities/activities/lib/constants'
import { APP_SETTING } from '@/shared/entities/app-settings/lib/constants'
import { CUSTOMER } from '@/shared/entities/customers/lib/constants'
import { MEETING } from '@/shared/entities/meetings/lib/constants'
import { PROJECT } from '@/shared/entities/projects/lib/constants'
import { PROPOSAL } from '@/shared/entities/proposals/lib/constants'
import { VOIP_CALL } from '@/shared/entities/voip-calls/lib/constants'
import { VOIP_DID } from '@/shared/entities/voip-dids/lib/constants'
import { VOIP_LINK_TOKEN } from '@/shared/entities/voip-link-tokens/lib/constants'
import { VOIP_MESSAGE } from '@/shared/entities/voip-messages/lib/constants'

export const ENTITY_NAMES = [
  CUSTOMER,
  MEETING,
  PROPOSAL,
  PROJECT,
  ACTIVITY,
  VOIP_CALL,
  VOIP_DID,
  VOIP_MESSAGE,
  VOIP_LINK_TOKEN,
  APP_SETTING,
] as const
export type EntityName = (typeof ENTITY_NAMES)[number]

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

      // Activities
      can('read', 'Activity')
      can('create', 'Activity')
      can('update', 'Activity')
      can('delete', 'Activity')
      // Calendar sync
      can('manage', 'Calendar')

      // Agents can only navigate fresh + projects pipelines.
      // Leads, rehash, dead are super-admin only (managed via 'manage' on 'CustomerPipeline').
      can('read', 'CustomerPipeline')

      can('read', 'User')

      // voip-in-house — agent ↔ already-known-customer comms (Phase 1).
      // Scoping (only see own rows) is enforced by entity visibility predicates;
      // CASL grants the action verbs the agent can use across them.
      can('read', 'VoipCall')
      can('create', 'VoipCall') // placeAgentCall via softphone

      can('read', 'VoipMessage')
      can('create', 'VoipMessage') // sendSms via thread UI

      can('read', 'VoipDid') // resolve own sticky DID

      can('read', 'VoipLinkToken')
      can('create', 'VoipLinkToken') // mint L-DOC links

      // No agent rule for AppSetting — super-admin only via the 'manage' on 'all'.
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
    // type objects (not plain strings). Since AppSubject uses plain strings,
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
