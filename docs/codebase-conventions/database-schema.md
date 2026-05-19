# Database & Schema Conventions

Drizzle ORM + Postgres (Neon). All application data lives here. Schema files at `src/shared/db/schema/`, one table per file, all re-exported from `index.ts`.

## Rules

### one-table-per-file

Every Postgres table lives in its own file under `src/shared/db/schema/`, named after the table (snake-or-kebab, matching the table name).

**Why**: grep-ability — `grep -l 'proposalsTable'` finds the schema in one hop.
**Reference impl**: `src/shared/db/schema/proposals.ts`
**Enforced by**: convention

### pgenum-placement

All `pgEnum()` declarations go in `src/shared/db/schema/meta.ts`, never in individual table files.

**Why**: pgEnums often need to be referenced from multiple tables; placing them in `meta.ts` avoids cross-file import cycles and makes the enum set discoverable.
**Reference impl**: `src/shared/db/schema/meta.ts`
**Enforced by**: convention

### pgenum-uses-const-array

A `pgEnum` is always derived from the `as const` array of the same enum (see `enum-standardization.md#const-array-source-of-truth`), never declared with literal strings.

**Why**: keeps the TypeScript type, the Zod schema, and the Postgres enum in lockstep.
**Reference impl**: `src/shared/db/schema/meta.ts` (any pgEnum line)
**Enforced by**: convention

### uuid-primary-keys

Primary keys are `uuid().primaryKey().defaultRandom()`. No serial ints.

**Why**: uniform shape across entities; no order leakage; safe for external sharing (proposal share tokens, etc.).
**Reference impl**: `src/shared/db/schema/proposals.ts:id`
**Enforced by**: convention

### timestamps-with-timezone

`createdAt` / `updatedAt` columns are `timestamp({ mode: 'string', withTimezone: true }).defaultNow()`. `mode: 'string'` returns ISO strings (Drizzle default is Date object, which serializes inconsistently across the tRPC boundary).

**Why**: ISO strings are JSON-safe end-to-end (server → tRPC → client) without manual serialization. Timezone-aware to avoid DST bugs.
**Reference impl**: `src/shared/db/lib/schema-helpers.ts` (timestamp helpers)
**Enforced by**: convention

### export-schemas-and-types

Every schema file exports the table, the `selectSchema`/`insertSchema` (drizzle-zod), and their inferred types.

```ts
export const proposals = pgTable('proposals', { ... })
export const selectProposalSchema = createSelectSchema(proposals, { ... })
export const insertProposalSchema = createInsertSchema(proposals, { ... })
export type SelectProposalSchema = z.infer<typeof selectProposalSchema>
export type InsertProposalSchema = z.infer<typeof insertProposalSchema>
```

**Why**: callers (DAL, services, tRPC) all want the same three handles. Inconsistent exports mean every consumer reinvents derivation.
**Reference impl**: `src/shared/db/schema/proposals.ts`
**Enforced by**: convention

### barrel-export-from-index

Every schema file is re-exported from `src/shared/db/schema/index.ts`. Imports from elsewhere always go through the barrel: `import { proposals } from '@/shared/db/schema'`.

**Why**: a single import line stays valid as files move; drizzle's `db` client is bound to the barrel.
**Reference impl**: `src/shared/db/schema/index.ts`
**Enforced by**: convention

## Anti-patterns

- **Inline pgEnums in a table file.** Move to `meta.ts`.
- **`integer().primaryKey()` / `serial()`.** Use `uuid().primaryKey().defaultRandom()`.
- **`timestamp().defaultNow()` (without `mode: 'string'`).** Will leak Date objects through tRPC.
- **`Record<string, unknown>` for typed JSONB columns.** Always use a Zod-validated schema from `src/shared/entities/<domain>/schemas/`.

## See also

- `docs/codebase-conventions/enum-standardization.md` — enum pipeline
- `src/shared/db/lib/schema-helpers.ts` — shared column helpers
- `pnpm db:push:dev` runs schema sync against the dev DB (NEVER `pnpm db:push` for dev work)
