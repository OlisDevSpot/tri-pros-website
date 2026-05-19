# Enum Standardization

Every fixed-set string value in the app — meeting outcomes, user roles, proposal statuses, lead-source kinds, trade types — flows through the same three-step pipeline. The const array is the source of truth; the TypeScript type, the Zod enum, and the Postgres pgEnum all derive from it.

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

### pgenum-from-const

If the value is stored in Postgres, declare the pgEnum in `src/shared/db/schema/meta.ts` from the same const array:

```ts
import { proposalStatuses } from '@/shared/constants/enums/proposals'
export const proposalStatusEnum = pgEnum('proposal_status', proposalStatuses)
```

The Drizzle column then uses `proposalStatusEnum`, NOT `text()`.

**Why**: Postgres enforces the value at the DB level, not just at the type level. Drift = runtime error not type error.
**Reference impl**: `src/shared/db/schema/meta.ts`
**Enforced by**: Postgres (insert/update fails with invalid value)

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
