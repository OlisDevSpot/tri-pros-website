// ─── CASL Permission Types ──────────────────────────────────────────────────
// These types define the shape of our permission system.
// AppAbility is the main type used everywhere — it's a CASL Ability
// parameterized with our specific actions and subjects.

import type { MongoAbility } from '@casl/ability'

// Actions a user can perform.
// 'manage' is CASL's built-in wildcard — means "all actions".
// 'access' is our custom action for route/feature gating (e.g., Dashboard).
export type AppActions = 'access' | 'create' | 'delete' | 'manage' | 'read' | 'update'

// Resources (subjects) that actions apply to.
// 'all' is CASL's built-in wildcard — means "all subjects".
// These map to your business entities, NOT database tables.
export type AppSubjects = 'Customer' | 'Dashboard' | 'Meeting' | 'Project' | 'Proposal' | 'User' | 'all'

// The main ability type used throughout the app.
// MongoAbility is CASL's default ability class — named "Mongo" for historical
// reasons but works with any backend. It's just the standard CASL ability.
export type AppAbility = MongoAbility<[AppActions, AppSubjects]>
