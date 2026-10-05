// Canonical entity-name constant for the FinanceOption entity. NOT currently a
// CASL subject: it is absent from `ENTITY_NAMES` (domains/permissions/abilities.ts),
// so it is not part of `EntityName` / `AppSubject`. Finance options are read-only
// reference data (served via `proposals.business.getFinanceOptions`, public). Add it
// to `ENTITY_NAMES` if the entity ever needs permission rules.
export const FINANCE_OPTION = 'FinanceOption' as const
