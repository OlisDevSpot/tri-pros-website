// Canonical entity-name constant for the Customer entity. Source of truth
// for `EntityName` and `AppSubject` (see domains/permissions/abilities.ts).
export const CUSTOMER = 'Customer' as const

// Customer age bounds — single source of truth. The customerProfile schema
// references these; UI inputs and tRPC inputs that accept age must too.
// see ../schemas/index.ts and ../DOCS.md#phone-visibility-threshold
export const CUSTOMER_AGE_MIN = 18
export const CUSTOMER_AGE_MAX = 120
