// ─── CASL Permission Types ──────────────────────────────────────────────────
// These types define the shape of our permission system.
// `AppAbility` is the main type used everywhere — it's a CASL Ability
// parameterized with our specific actions and subjects.
//
// Subjects derive from per-entity constants:
//   - `EntityName` (5 business entities) comes from `abilities.ts`, which
//     imports each entity's identity from `entities/<entity>/lib/constants.ts`.
//   - The non-entity subjects below are feature/route gates that aren't
//     real business entities — they stay hand-maintained.

import type { MongoAbility, MongoQuery } from '@casl/ability'

import type { EntityName } from './abilities'

// Actions a user can perform.
// 'manage' is CASL's built-in wildcard — means "all actions".
// 'access' is our custom action for route/feature gating (e.g., Dashboard).
// 'assign' is our custom action for reassigning ownership (e.g., meeting owner).
export type AppAction = 'access' | 'assign' | 'create' | 'delete' | 'manage' | 'own' | 'read' | 'update'

// Subjects (resources) that actions apply to.
// `EntityName` covers the 5 business entities (Customer/Meeting/Proposal/Project/Activity).
// The rest are non-entity feature gates that stay hand-maintained:
//   - 'all'              CASL built-in wildcard
//   - 'Dashboard'        route-level gate (dashboard access)
//   - 'Calendar'         feature gate (GCal sync)
//   - 'CustomerPipeline' feature gate (manage rehash/dead pipeline access)
//   - 'LeadsPool'        feature gate (shared leads pool visibility)
//   - 'User'             user-record reads (no Entity Server System integration yet)
export type AppSubject
  = EntityName
    | 'all'
    | 'Calendar'
    | 'CustomerPipeline'
    | 'Dashboard'
    | 'LeadsPool'
    | 'User'

// Row conditions our rules use — the three custom document operators
// (see scope/operators/*.ts) plus the scalar column conditions CASL already
// supports (e.g. { ownerId }). Kept open (`| MongoQuery` union) so existing
// scalar conditions still type-check. NOTE: these keys are how conditions are
// AUTHORED in `can()` calls (with the leading `$`) — that's independent of
// how the `defineScopeOperator` REGISTRY names them internally; see
// scope/conditions-matcher.ts for why the registry drops the `$`.
export type AppConditions
  = MongoQuery
    | { $participatesViaMeeting?: { via: 'customerId' | 'meetingId' | 'projectId' | 'self' } }
    | { $hasNoMeeting?: boolean }
    | { $inDerivedPipeline?: readonly ('dead' | 'fresh' | 'leads' | 'projects' | 'rehash')[] }

// The main ability type used throughout the app.
// MongoAbility is CASL's default ability class — named "Mongo" for historical
// reasons but works with any backend. It's just the standard CASL ability.
export type AppAbility = MongoAbility<[AppAction, AppSubject], AppConditions>
