# Enum Standardization

Every fixed-set string value in the app — meeting outcomes, user roles, proposal statuses, lead-source kinds, trade types — flows through the same pipeline. The const array is the source of truth; the TypeScript type, the Zod enum, and the Drizzle column typing all derive from it. **Storage is a plain `text` column — pgEnum is the documented exception, not the default** (Closed Vocabulary Standard, ratified 2026-07-14; see `#text-with-enum`).

## Rules

### const-array-source-of-truth

Every option set is declared once as a `readonly` tuple in `src/shared/constants/enums/<domain>.ts`.

```ts
// src/shared/constants/enums/proposals.ts
export const proposalStatuses = [
  'draft',
  'proposal-sent',
  'approved',
  'declined',
  'expired',
] as const
```

**Why**: a single mutation point; everything else derives.
**Reference impl**: `src/shared/constants/enums/proposals.ts`
**Enforced by**: convention

### type-derived-from-const

The TypeScript type lives in `src/shared/types/enums/<domain>.ts` and derives from the const array via `(typeof X)[number]`.

```ts
// src/shared/types/enums/proposals.ts
import type { proposalStatuses } from '@/shared/constants/enums/proposals'
export type ProposalStatus = (typeof proposalStatuses)[number]
```

**Why**: type stays in lockstep with the array — add a value to the array, type updates automatically.
**Reference impl**: `src/shared/types/enums/proposals.ts`
**Enforced by**: tsc (if you forget to add a value, downstream `switch (status)` exhaustiveness fails)

### text-with-enum

If the value is stored in Postgres, the column is plain `text` with Drizzle's `enum` config from the same const array — NO pgEnum:

```ts
import { triggerEvents } from '@/shared/constants/enums/customers'
// in the pgTable definition:
triggerEvent: text('trigger_event', { enum: triggerEvents }),
```

This gives the identical compile-time union type and the identical drizzle-zod `z.enum` derivation as a pgEnum column — with zero Postgres catalog objects. Runtime validation happens where every write already passes: the DAL boundary's Zod parse (raw `db` writes outside the DAL are forbidden; scripts use Zod gates).

**Why**: the const array is the single source of truth; a pgEnum is that vocabulary hand-maintained in a second place (the pg catalog), and it calcifies labels — every marketing-driven relabel becomes an `ALTER TYPE` migration plus data archaeology (the Wave-1 `LEGACY_ENUM_MAP` ceremony existed solely because pgEnums froze old labels; with text columns each relabel is a TS edit + one `UPDATE`). Prod was heading to 39 enum types before this rule.
**Reference impl**: `src/shared/db/schema/customer-profiles.ts`
**Enforced by**: convention + review (tsc enforces the value set at compile time; Zod at the DAL boundary at runtime)

### pgenum-only-with-db-side-consumer

Minting a pgEnum requires a documented DB-side consumer: a SQL predicate that compares enum ordering, a constraint another system relies on, or an external reader that needs catalog-level enforcement. As of 2026-07-14 there are ZERO such cases — no SQL anywhere uses `enum_range`, enum ordering, or enum casts. If you believe you have one, document it next to the pgEnum declaration in `meta.ts` and in the PR.

**Why**: without a DB-side consumer, the enum type is pure ceremony with DDL friction on every vocabulary change.
**Enforced by**: review

### legacy-pgenum-conversion

The 23 pre-existing pgEnums (audited 2026-07-14) convert to `text` **opportunistically**: any wave/migration that already touches a table converts that table's enum columns in the same push (`ALTER COLUMN ... TYPE text` + `DROP TYPE`). A dedicated final sweep for whatever remains is tracked as a deferred issue — do not run it as a standalone prod migration without cause.

**Why**: big-bang conversion is churn with no functional gain; opportunistic conversion reaches the same end state for free.
**Enforced by**: convention (check this rule whenever a migration touches a table with enum columns)

### barrel-from-domain-files

`src/shared/constants/enums/index.ts` re-exports from each domain file; `src/shared/types/enums/index.ts` mirrors. Consumers import from the barrel.

**Why**: refactoring a domain file (rename, split) doesn't break consumers.
**Reference impl**: `src/shared/constants/enums/index.ts`
**Enforced by**: convention

### readonly-string-array

When a prop or type accepts one of these arrays, declare it as `readonly string[]`, not `string[]`.

```ts
type SelectProps = { options: readonly string[] }
```

**Why**: `as const` arrays are `readonly` — `string[]` won't accept them.
**Reference impl**: any select component accepting enum options
**Enforced by**: tsc

## Anti-patterns

- **Defining option arrays inline in a feature file or schema file.** Move to `constants/enums/<domain>.ts`.
- **`pgEnum('x', ['a', 'b', 'c'])` with literal strings.** Reference the const array.
- **Drizzle column as `text()` when the value set is fixed.** Use the pgEnum.
- **Duplicating the type as `'a' | 'b' | 'c'` instead of `(typeof arr)[number]`.** Will drift the moment the array changes.

## Reference flow

```
constants/enums/proposals.ts           types/enums/proposals.ts          db/schema/meta.ts
─────────────────────────────         ──────────────────────────        ──────────────────────────
const proposalStatuses = [...]  ────► type ProposalStatus =       ────► pgEnum('proposal_status',
  as const                              (typeof proposalStatuses)         proposalStatuses)
                                          [number]
```

All three derive from the const array. Modify the array → everything follows.

## See also

- `docs/codebase-conventions/database-schema.md#pgenum-placement` — where pgEnums live
