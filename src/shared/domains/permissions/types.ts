// ─── CASL Permission Types ──────────────────────────────────────────────────
// These types define the shape of our permission system.
// AppAbility is the main type used everywhere — it's a CASL Ability
// parameterized with our specific actions and subjects.

import type { MongoAbility } from '@casl/ability'

// Actions a user can perform.
// 'manage' is CASL's built-in wildcard — means "all actions".
// 'access' is our custom action for route/feature gating (e.g., Dashboard).
// 'assign' is our custom action for reassigning ownership (e.g., meeting owner).
export type AppActions = 'access' | 'assign' | 'create' | 'delete' | 'manage' | 'read' | 'update'

// Resources (subjects) that actions apply to.
// 'all' is CASL's built-in wildcard — means "all subjects".
// These map to your business entities, NOT database tables.
// 'CustomerPipeline' — pipeline management feature (view rehash/dead, move between pipelines),
//   distinct from Customer CRUD — governs who can manage pipeline state and transitions.
export type AppSubjects = 'Activity' | 'Calendar' | 'Customer' | 'CustomerPipeline' | 'Dashboard' | 'Meeting' | 'Project' | 'Proposal' | 'User' | 'all'

// The main ability type used throughout the app.
// MongoAbility is CASL's default ability class — named "Mongo" for historical
// reasons but works with any backend. It's just the standard CASL ability.
export type AppAbility = MongoAbility<[AppActions, AppSubjects]>
