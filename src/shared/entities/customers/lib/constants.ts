// Canonical entity-name constant for the Customer entity. Source of truth
// for `EntityName` and `AppSubject` (see domains/permissions/abilities.ts).
export const CUSTOMER = 'Customer' as const

// CASL subject for the `customer_profiles` 1:1 child table (Addendum B,
// 2026-07-14) — a different permission boundary than `Customer` itself
// (agents get read+update on the whole profile; `age` stays a Customer field
// grant). see docs/superpowers/specs/2026-07-09-jsonb-decomposition-program-design.md §10
export const CUSTOMER_PROFILE = 'CustomerProfile' as const

// 1:1 attribution child (Addendum B: 1:1 children get their own subject).
// SYSTEM-only writes (intake capture); agents/dispatchers read.
export const CUSTOMER_LEAD_ATTRIBUTION = 'CustomerLeadAttribution' as const

// Customer age bounds — single source of truth. The customerProfile schema
// references these; UI inputs and tRPC inputs that accept age must too.
// see ../schemas/index.ts and ../DOCS.md#phone-visibility-threshold
export const CUSTOMER_AGE_MIN = 18
export const CUSTOMER_AGE_MAX = 120
