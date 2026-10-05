# Permissions Unit 1 — Typed Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the entity specs the single typed source for permissions: two spec constructors, the 19 specs converted, a type-only list with the types derived from it, typed `can` / `cannot`, and a file of lines that must not compile. Nothing a user can observe changes.

**Architecture:** Specs stop being object literals with `satisfies` and are built by `defineEntitySpec` (has its own CASL subject) or `defineSubEntitySpec` (a field of its parent's subject). The constructors capture literal types, so a type-only union of every spec can derive each entity's row type, legal rule fields and condition columns. `defineRules` types rule authoring against those; in this unit nothing calls it except the must-not-compile file. Today's rules (`abilities.ts`) and today's enforcement (the legacy scope engine) are untouched.

**Tech Stack:** TypeScript 5.9 (`const` type parameters), Drizzle ORM 0.45 (`pg-core` table types), Zod 4, `@casl/ability` 6.8.0 (types only in this unit).

**Spec:** `docs/superpowers/specs/2026-10-05-permissions-structure-design.md` — §2 (names), §4 (specs), §5.1–§5.4 (rules, fields, operators), §9 (where each mistake is caught), §10 (verification), §11 unit 1.

## Global Constraints

- **No behaviour change.** `src/shared/domains/permissions/abilities.ts`, `src/shared/dal/server/lib/scope.ts`, `create-crud-dal.ts`, the middlewares and every router keep their behaviour. The only runtime edit outside the spec files is two reads of `spec.caslSubject` becoming `subjectOf(spec)`.
- **A spec is converted according to what it is today.** A spec whose `caslSubject` is its own constant becomes an entity, with no `parent` added even when the table has one (customer notes, applications, voip campaign contacts). Only the four specs that already declare `parent` and reuse the parent's subject become sub-entities. Reclassifying is unit 3, together with the rule change.
- **Names are fixed by the spec:** `defineEntitySpec`, `defineSubEntitySpec`, `parent: { spec, fk, field }`, `subject`, `conditionColumns`, `defineRules`. `entityName` stays on every spec.
- **No test runner, no unit tests.** Verification is `pnpm tsc`, `pnpm lint`, and the must-not-compile file. Never `pnpm build`.
- **Lint baseline.** `pnpm lint` on this branch reports two formatting errors in `src/app/(frontend)/globals.css` that come from main and are out of scope. "Lint passes" in this plan means: no error outside that file.
- **Type-check baseline.** A warm `pnpm tsc` takes about 12 s on this branch. Task 4 compares against it.
- **Inference trap.** A type parameter that should capture a literal must be inferred from a plain property (`field: TField`) and validated in an intersection (`& { field: FreeFieldName<…> }`). Written as the conditional type alone, it falls back to `string` and every field check silently accepts anything.
- **Empty-type trap.** An object type with no properties accepts every object, and intersecting a type with `{}` switches off TypeScript's "no properties in common" check. Eight of the fifteen entities start with no condition columns, so a conditions parameter typed as a plain mapped type would accept an operator, an unknown key, or even a field list. Task 3's `Only<>` and `NotAList` exist for this; do not simplify them away.
- **Spec §9 rows that wait.** The two client-check rows (a mistyped field in a check; a row lacking condition columns) get their must-not-compile lines in unit 2, when the typed client checks exist.
- **Lint rules that bite here:** every `// @ts-expect-error` needs a description after it; unused top-level names are errors unless exported or `_`-prefixed; type imports sort before value imports; top-level functions are `function` declarations; object shapes are `interface`, not `type X = {}`.
- **Comments say why, never what.** No citations of plans, specs or tasks from code.
- **Commits:** conventional, staged by explicit path, each ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. After each commit: `git push origin refactor/285-refactor-permissions-casl-scope-compiler` (the origin copy is the backup).

## Review Focus

1. **A loosened type disables the checks without any error.** If `FieldOf<S>` or a `field` name widens to `string`, or a conditions type becomes empty, wrong rules compile. Pinned by the typo lines and the no-condition-column lines in the must-not-compile file (Tasks 2 and 3): they stop erroring and `pnpm tsc` fails with TS2578.
2. **Schema precision lost through a constructor.** If `schemas` widens, every typed DAL handler degrades to loose input types and nothing fails. Pinned by the `Equal<SpecInsert<…>, z.input<…>>` lines in Task 2.
3. **A converted spec checks a different subject than before.** Pinned by the exact `EntitySubject` union and the four sub-entity field assertions in Task 2, plus the `caslSubject` → `subject` table in Task 1.
4. **A spec missing from the type-only list.** Its subject and fields vanish from rule typing with no error. Pinned by the count check in Task 4 (constructor call sites = union members = 19).
5. **Server code reaching a client bundle.** `specs.ts`, `operators.ts` and `define-rules.ts` are client-safe only if every import of a spec or table is `import type`. Pinned by the grep in Task 4.

---

## File map

| File | Responsibility |
|---|---|
| `src/shared/dal/server/types.ts` (modify) | `EntitySpec`, `SubEntitySpec`, `AnyServerSpec`; `EntityServerSpec` becomes their union |
| `src/shared/dal/server/lib/define-spec.ts` (create) | `defineEntitySpec`, `defineSubEntitySpec`, `subjectOf` |
| 19 × `server-spec.ts` (modify) | built with the constructors |
| `src/trpc/lib/create-crud-router.ts` (modify) | reads the subject through `subjectOf` |
| `src/shared/domains/permissions/specs.ts` (create) | the type-only list and the types derived from it |
| `src/shared/domains/permissions/operators.ts` (create) | operator names, payloads, and the subjects each may sit on |
| `src/shared/domains/permissions/rules/define-rules.ts` (create) | typed `can` / `cannot` → stock CASL rules |
| `src/shared/domains/permissions/type-checks/must-not-compile.ts` (create) | one line per mistake the types must reject; never imported |

---

### Task 1: Spec constructors and the 19 specs

**Files:**
- Modify: `src/shared/dal/server/types.ts` (the `EntityServerSpec` interface, currently lines 113–133, and its imports)
- Create: `src/shared/dal/server/lib/define-spec.ts`
- Modify: `src/trpc/lib/create-crud-router.ts:124,146`
- Modify: the 19 `server-spec.ts` files in the table below

**Interfaces:**
- Produces: `EntitySpec`, `SubEntitySpec`, `AnyServerSpec`, `ServerSpecSchemas` (types, from `@/shared/dal/server/types`); `defineEntitySpec`, `defineSubEntitySpec`, `subjectOf` (from `@/shared/dal/server/lib/define-spec`). `EntityServerSpec<TTable, TId>` keeps its name and both type parameters.

- [ ] **Step 1: Replace the spec type in `src/shared/dal/server/types.ts`**

Remove `AppSubject` from the import on line 11 (keep `AppAbility`). Replace the whole `export interface EntityServerSpec … { … }` block with:

```ts
type ZodObjectAny = z.ZodObject<Record<string, z.ZodTypeAny>>

export interface ServerSpecSchemas {
  insert: ZodObjectAny
  update: ZodObjectAny
  select: ZodObjectAny
}

interface ServerSpecBase<TTable extends PgTable, TSchemas extends ServerSpecSchemas> {
  entityName: EntityName
  table: TTable
  schemas: TSchemas
  /** Defaults to 'id'. Override for serial PKs or custom column names. */
  primaryKey?: string
  /** The entity's OWN visibility fragment. A top-level entity MUST declare it or it is unscoped (checked in `resolveEffectiveScope`). Entities only. */
  visibility?: (scope: VisibilityScope) => SQL
  /** Entities only. */
  shareable?: { tokenColumn: string }
}

/** Has its own CASL subject. A `parent` adds reach through another entity without giving up the subject. */
export interface EntitySpec<
  TTable extends PgTable = PgTable,
  TSchemas extends ServerSpecSchemas = ServerSpecSchemas,
  TSubject extends EntityName = EntityName,
  TConditionColumn extends string = string,
  TParent extends AnyServerSpec = AnyServerSpec,
> extends ServerSpecBase<TTable, TSchemas> {
  subject: TSubject
  /** The only columns a rule condition may name. A row checked against a rule on the client must carry them. */
  conditionColumns: readonly TConditionColumn[]
  parent?: { spec: TParent, fk: PgColumn }
}

/** Has no subject: it is the field `parent.field` of its parent's subject. */
export interface SubEntitySpec<
  TTable extends PgTable = PgTable,
  TSchemas extends ServerSpecSchemas = ServerSpecSchemas,
  TParent extends AnyServerSpec = AnyServerSpec,
  TField extends string = string,
> extends ServerSpecBase<TTable, TSchemas> {
  parent: { spec: TParent, fk: PgColumn, field: TField }
}

export type AnyServerSpec = EntitySpec<any, any, any, any, any> | SubEntitySpec<any, any, any, any>

export type EntityServerSpec<
  TTable extends PgTable = PgTable,
  // eslint-disable-next-line unused-imports/no-unused-vars -- Phantom type param carried through to CrudHandlers<TTable, TId> via createCrudDal
  TId extends string | number = string,
> = EntitySpec<TTable> | SubEntitySpec<TTable>
```

`SpecInsert`, `SpecUpdate`, `SpecId` and `SpecCrudHandlers` (lines 107–111) stay exactly as they are.

- [ ] **Step 2: Create `src/shared/dal/server/lib/define-spec.ts`**

```ts
import type { SQL } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'

import type { AnyServerSpec, EntityServerSpec, EntitySpec, ServerSpecSchemas, SubEntitySpec, VisibilityScope } from '../types'
import type { EntityName } from '@/shared/domains/permissions/abilities'

type ColumnOf<TTable extends PgTable> = TTable['_']['columns'][keyof TTable['_']['columns']]
type ColumnKey<TTable extends PgTable> = keyof TTable['$inferSelect'] & string
type TableOf<TSpec> = TSpec extends { table: infer TTable extends PgTable } ? TTable : never
type FreeFieldName<TParent, TField extends string> = TField extends ColumnKey<TableOf<TParent>> ? never : TField

export function defineEntitySpec<
  TTable extends PgTable,
  TSchemas extends ServerSpecSchemas,
  const TSubject extends EntityName,
  const TConditionColumn extends ColumnKey<TTable>,
  TParent extends AnyServerSpec = never,
>(spec: {
  entityName: EntityName
  subject: TSubject
  table: TTable
  schemas: TSchemas
  conditionColumns: readonly TConditionColumn[]
  primaryKey?: ColumnKey<TTable>
  visibility?: (scope: VisibilityScope) => SQL
  shareable?: { tokenColumn: ColumnKey<TTable> }
  parent?: { spec: TParent, fk: ColumnOf<TTable> }
}): EntitySpec<TTable, TSchemas, TSubject, TConditionColumn, TParent> {
  return spec
}

export function defineSubEntitySpec<
  TTable extends PgTable,
  TSchemas extends ServerSpecSchemas,
  TParent extends AnyServerSpec,
  const TField extends string,
>(spec: {
  entityName: EntityName
  table: TTable
  schemas: TSchemas
  primaryKey?: ColumnKey<TTable>
  // `field` is inferred from the plain property and validated by the intersection: inferring
  // through the conditional type alone falls back to `string` and accepts any name.
  parent: { spec: TParent, fk: ColumnOf<TTable>, field: TField } & { field: FreeFieldName<TParent, TField> }
}): SubEntitySpec<TTable, TSchemas, TParent, TField> {
  return spec
}

/** The CASL subject a spec is checked under: its own, or its parent's for a sub-entity. */
export function subjectOf(spec: EntityServerSpec): EntityName {
  return 'subject' in spec ? spec.subject : subjectOf(spec.parent.spec)
}
```

- [ ] **Step 3: Read the subject through `subjectOf` in `src/trpc/lib/create-crud-router.ts`**

Add the import beside the other value imports:

```ts
import { subjectOf } from '@/shared/dal/server/lib/define-spec'
```

In `assertCan` (line 124) change `ability.can(action, spec.caslSubject)` to `ability.can(action, subjectOf(spec))`. In `assertCanUpdateFields` (line 146) change `ability.can('update', spec.caslSubject, field)` to `ability.can('update', subjectOf(spec), field)`. Nothing else in the file changes.

- [ ] **Step 4: Convert the 19 spec files**

The rule, for every file:
1. Replace `import type { EntityServerSpec } from '@/shared/dal/server/types'` with `import { defineEntitySpec } from '@/shared/dal/server/lib/define-spec'` (or `defineSubEntitySpec`), placed with the value imports in sorted order.
2. Replace `export const xServerSpec = { … } satisfies EntityServerSpec<typeof table>` (or `…<typeof table, number>`) with `export const xServerSpec = defineEntitySpec({ … })` (or `defineSubEntitySpec({ … })`).
3. Entity: rename `caslSubject:` to `subject:` (same value) and add `conditionColumns:` from the table. Sub-entity: delete the `caslSubject:` line and add `field:` inside `parent`.
4. Keep every other property and every other export (`xSchemas`, local `updateXSchema`) as it is.
5. Where a comment says the spec "reuses the parent's `caslSubject`", reword it to say the spec is a field of its parent.

| File | Constructor | `subject` (old `caslSubject`) | `conditionColumns` | Sub-entity `field` |
|---|---|---|---|---|
| `src/shared/entities/meetings/lib/server-spec.ts` | entity | `MEETING` | `[]` | |
| `src/shared/entities/app-settings/lib/server-spec.ts` | entity | `APP_SETTING` | `[]` | |
| `src/shared/entities/customer-notes/lib/server-spec.ts` | entity | `CUSTOMER_NOTE` | `['authorId']` | |
| `src/shared/entities/applications/lib/server-spec.ts` | entity | `APPLICATION` | `[]` | |
| `src/shared/entities/lead-sources/lib/server-spec.ts` | entity | `LEAD_SOURCE` | `[]` | |
| `src/shared/entities/customers/lib/server-spec.ts` | entity | `CUSTOMER` | `[]` | |
| `src/shared/entities/voip-contact-fields/lib/server-spec.ts` | entity | `VOIP_CONTACT_FIELD` | `[]` | |
| `src/shared/entities/voip-campaigns/lib/server-spec.ts` | entity | `VOIP_CAMPAIGN` | `[]` | |
| `src/shared/entities/voip-dids/lib/server-spec.ts` | entity | `VOIP_DID` | `['assignedUserId']` | |
| `src/shared/entities/voip-campaign-contacts/lib/server-spec.ts` | entity | `VOIP_CAMPAIGN_CONTACT` | `[]` | |
| `src/shared/entities/voip-calls/lib/server-spec.ts` | entity | `VOIP_CALL` | `['agentUserId']` | |
| `src/shared/entities/voip-link-tokens/lib/server-spec.ts` | entity | `VOIP_LINK_TOKEN` | `['createdByUserId']` | |
| `src/shared/entities/voip-messages/lib/server-spec.ts` | entity | `VOIP_MESSAGE` | `['agentUserId']` | |
| `src/shared/modules/projects/core/server-spec.ts` | entity | `PROJECT` | `['ownerId']` | |
| `src/shared/modules/projects/media/server-spec.ts` | sub-entity | — (was `projectServerSpec.caslSubject`) | — | `'media'` |
| `src/shared/modules/proposals/core/server-spec.ts` | entity | `PROPOSAL` | `['id']` | |
| `src/shared/modules/proposals/incentives/server-spec.ts` | sub-entity | — (was `proposalServerSpec.caslSubject`) | — | `'incentives'` |
| `src/shared/modules/proposals/media/server-spec.ts` | sub-entity | — (was `proposalServerSpec.caslSubject`) | — | `'media'` |
| `src/shared/modules/proposals/views/server-spec.ts` | sub-entity | — (was `proposalServerSpec.caslSubject`) | — | `'views'` |

`conditionColumns` holds the columns that today's row filter compares to the user (`voipDids.assignedUserId`, `voipCalls.agentUserId`, `voipMessages.agentUserId`, `voipLinkTokens.createdByUserId`) or that a decided rule compares (`customerNotes.authorId`, `projects.ownerId`, `proposals.id`). Everything else starts empty and grows when a rule needs a column.

An entity, after (`src/shared/modules/proposals/core/server-spec.ts`). Lines 11–25 of the file (`updateProposalSchema`, `proposalSchemas` and their comments) are not touched and are not repeated here:

```ts
import { defineEntitySpec } from '@/shared/dal/server/lib/define-spec'
import {
  insertProposalSchema,
  proposals,
  selectProposalSchema,
} from '@/shared/db/schema'
import { PROPOSAL } from '@/shared/modules/proposals/core/lib/constants'
import { proposalVisibility } from '@/shared/modules/proposals/core/lib/visibility'

export const proposalServerSpec = defineEntitySpec({
  entityName: PROPOSAL,
  subject: PROPOSAL,
  conditionColumns: ['id'],
  visibility: proposalVisibility,
  table: proposals,
  schemas: {
    insert: insertProposalSchema,
    update: updateProposalSchema,
    select: selectProposalSchema,
  },
  shareable: { tokenColumn: 'token' },
})
```

A sub-entity, after (`src/shared/modules/proposals/views/server-spec.ts`). Lines 11–20 of the file (`updateProposalViewSchema`, `proposalViewSchemas` and their comments) are not touched and are not repeated here:

```ts
import { defineSubEntitySpec } from '@/shared/dal/server/lib/define-spec'
import {
  insertProposalViewSchema,
  proposalViews,
  selectProposalViewSchema,
} from '@/shared/db/schema/proposal-views'
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import { PROPOSAL_VIEW } from '@/shared/modules/proposals/views/lib/constants'

/**
 * `proposal_views` has no independent ownership, so no own `visibility`: its
 * effective scope is parent-derived —
 * `proposalId IN (SELECT proposals.id WHERE <proposal effective scope>)` —
 * folded into `ctx.scope` by whichever procedure resolves this spec. It is the
 * field `views` of `Proposal`. No lifecycle hooks: a view is an immutable event
 * with nothing to derive.
 */
export const proposalViewServerSpec = defineSubEntitySpec({
  entityName: PROPOSAL_VIEW,
  parent: { spec: proposalServerSpec, fk: proposalViews.proposalId, field: 'views' },
  table: proposalViews,
  schemas: {
    insert: insertProposalViewSchema,
    update: updateProposalViewSchema,
    select: selectProposalViewSchema,
  },
})
```

An entity with a primary-key override, after (`src/shared/entities/voip-campaign-contacts/lib/server-spec.ts`, the spec object only):

```ts
export const voipCampaignContactServerSpec = defineEntitySpec({
  entityName: VOIP_CAMPAIGN_CONTACT,
  subject: VOIP_CAMPAIGN_CONTACT,
  conditionColumns: [],
  visibility: voipCampaignContactVisibility,
  table: voipCampaignContacts,
  // PK is `customer_id` (1:1 with customers), not `id`.
  primaryKey: 'customerId',
  schemas: {
    insert: insertVoipCampaignContactSchema,
    update: updateVoipCampaignContactSchema,
    select: selectVoipCampaignContactSchema,
  },
})
```

- [ ] **Step 5: Type-check**

Run: `pnpm tsc`
Expected: no errors.

If an error appears at the `getByIdImpl` / `createImpl` / `updateImpl` / `deleteImpl` / `duplicateImpl` / `getPkColumn` calls in `src/shared/dal/server/lib/create-crud-dal.ts` saying the spec is not assignable to `EntityServerSpec<TTable, …>`, change those six private functions' `spec` parameter type to `EntityServerSpec<any, any>`. They read only `table`, `schemas`, `primaryKey` and `entityName`. Change nothing else in that file.

- [ ] **Step 6: Confirm nothing still uses the old shape**

Run: `git grep -n "caslSubject" -- src ; git grep -n "satisfies EntityServerSpec" -- src`
Expected: no output from either.

Run: `git grep -c "defineEntitySpec(\|defineSubEntitySpec(" -- 'src/**/server-spec.ts' | wc -l`
Expected: `19`

- [ ] **Step 7: Lint**

Run: `pnpm lint`
Expected: no error outside `src/app/(frontend)/globals.css`.

- [ ] **Step 8: Commit**

```bash
git add -- src/shared/dal/server/types.ts src/shared/dal/server/lib/define-spec.ts src/trpc/lib/create-crud-router.ts \
  src/shared/entities/*/lib/server-spec.ts src/shared/modules/projects/core/server-spec.ts src/shared/modules/projects/media/server-spec.ts \
  src/shared/modules/proposals/core/server-spec.ts src/shared/modules/proposals/incentives/server-spec.ts \
  src/shared/modules/proposals/media/server-spec.ts src/shared/modules/proposals/views/server-spec.ts
git commit -m "refactor(permissions): entity specs are built by defineEntitySpec and defineSubEntitySpec

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push origin refactor/285-refactor-permissions-casl-scope-compiler
```

---

### Task 2: The type-only list, derived types, and the first must-not-compile lines

**Files:**
- Create: `src/shared/domains/permissions/type-checks/must-not-compile.ts`
- Create: `src/shared/domains/permissions/specs.ts`

**Interfaces:**
- Consumes: the 19 `…ServerSpec` exports and `defineEntitySpec` / `defineSubEntitySpec` from Task 1; `SpecInsert` from `@/shared/dal/server/types`.
- Produces (from `@/shared/domains/permissions/specs`): `ServerSpecs`, `EntitySubject`, `SpecOf<S>`, `RowOf<S>`, `ConditionColumnOf<S>`, `FieldOf<S>`, `DuplicateFieldsIn<TSpecs>`.

- [ ] **Step 1: Write the must-not-compile file first**

Create `src/shared/domains/permissions/type-checks/must-not-compile.ts`:

```ts
// Never imported. It exists for `pnpm tsc`: each `@ts-expect-error` line is a mistake the
// permission types must reject. If an edit loosens a type, the line stops erroring and the
// type-check fails with "Unused '@ts-expect-error' directive".

import type z from 'zod'

import type { SpecInsert } from '@/shared/dal/server/types'
import type { insertProjectMediaFilesSchema } from '@/shared/db/schema/project-media-files'
import type { insertProposalSchema } from '@/shared/db/schema/proposals'
import type { ConditionColumnOf, DuplicateFieldsIn, EntitySubject, FieldOf, RowOf, ServerSpecs } from '@/shared/domains/permissions/specs'

import { defineEntitySpec, defineSubEntitySpec } from '@/shared/dal/server/lib/define-spec'
import { customers } from '@/shared/db/schema/customers'
import { proposalMediaFiles } from '@/shared/db/schema/proposal-media-files'
import { proposalViews } from '@/shared/db/schema/proposal-views'
import { proposals } from '@/shared/db/schema/proposals'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import { projectMediaServerSpec } from '@/shared/modules/projects/media/server-spec'
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import { proposalMediaServerSpec } from '@/shared/modules/proposals/media/server-spec'
import { proposalViewServerSpec } from '@/shared/modules/proposals/views/server-spec'

type Expect<T extends true> = T
type Equal<A, B> = (<X>() => X extends A ? 1 : 2) extends (<X>() => X extends B ? 1 : 2) ? true : false
type AssertNever<T extends never> = T

// ── spec constructors ──────────────────────────────────────────────────────

// @ts-expect-error the foreign key belongs to another table
defineSubEntitySpec({ entityName: 'ProposalView', table: proposalViews, schemas: proposalViewServerSpec.schemas, parent: { spec: proposalServerSpec, fk: proposals.id, field: 'views2' } })
// @ts-expect-error the field name shadows a real column of the parent
defineSubEntitySpec({ entityName: 'ProposalView', table: proposalViews, schemas: proposalViewServerSpec.schemas, parent: { spec: proposalServerSpec, fk: proposalViews.proposalId, field: 'status' } })
// @ts-expect-error a sub-entity has no token column of its own
defineSubEntitySpec({ entityName: 'ProposalView', table: proposalViews, schemas: proposalViewServerSpec.schemas, shareable: { tokenColumn: 'id' }, parent: { spec: proposalServerSpec, fk: proposalViews.proposalId, field: 'views2' } })
// @ts-expect-error a condition column must be a column of the table
defineEntitySpec({ entityName: 'Customer', subject: 'Customer', table: customers, schemas: customerServerSpec.schemas, conditionColumns: ['nope'] })
// @ts-expect-error the primary key must be a column of the table
defineEntitySpec({ entityName: 'Customer', subject: 'Customer', table: customers, schemas: customerServerSpec.schemas, conditionColumns: [], primaryKey: 'nope' })
// @ts-expect-error the token column must be a column of the table
defineEntitySpec({ entityName: 'Proposal', subject: 'Proposal', table: proposals, schemas: proposalServerSpec.schemas, conditionColumns: [], shareable: { tokenColumn: 'nope' } })
// @ts-expect-error the subject must be a known entity name
defineEntitySpec({ entityName: 'Customer', subject: 'Custmer', table: customers, schemas: customerServerSpec.schemas, conditionColumns: [] })

// ── the constructors keep the schemas precise ──────────────────────────────

export type SchemasStayPrecise = [
  Expect<Equal<SpecInsert<typeof proposalServerSpec>, z.input<typeof insertProposalSchema>>>,
  Expect<Equal<SpecInsert<typeof projectMediaServerSpec>, z.input<typeof insertProjectMediaFilesSchema>>>,
]

// ── what the list derives ──────────────────────────────────────────────────

export type TheListIsExact = [
  Expect<Equal<EntitySubject, 'AppSetting' | 'Application' | 'Customer' | 'CustomerNote' | 'LeadSource' | 'Meeting' | 'Project' | 'Proposal' | 'VoipCall' | 'VoipCampaign' | 'VoipCampaignContact' | 'VoipContactField' | 'VoipDid' | 'VoipLinkToken' | 'VoipMessage'>>,
  Expect<Equal<ConditionColumnOf<'CustomerNote'>, 'authorId'>>,
  Expect<Equal<ConditionColumnOf<'Customer'>, never>>,
  Expect<Equal<RowOf<'Proposal'>['status'], 'approved' | 'declined' | 'draft' | 'sent'>>,
]

export const proposalFields: FieldOf<'Proposal'>[] = ['status', 'views', 'views.*', 'views.**', 'views.viewedAt', 'incentives', 'media', 'media.**']
export const projectFields: FieldOf<'Project'>[] = ['title', 'media', 'media.phase']
export const customerFields: FieldOf<'Customer'>[] = ['age', 'name', 'phone', 'email', 'address', 'city', 'state', 'zip', 'pipelineStage']

// @ts-expect-error not a field of Proposal
export const fieldTypo: FieldOf<'Proposal'> = 'veiws'
// @ts-expect-error not a column of proposal_views
export const subEntityColumnTypo: FieldOf<'Proposal'> = 'views.nope'
// @ts-expect-error `views` belongs to Proposal, not Customer
export const otherParentsField: FieldOf<'Customer'> = 'views'
// @ts-expect-error a customer note is an entity today, not a field of Customer
export const notAFieldYet: FieldOf<'Customer'> = 'notes'

// ── one field name per parent ──────────────────────────────────────────────

export type NoDuplicateFields = AssertNever<DuplicateFieldsIn<ServerSpecs>>

const secondViews = defineSubEntitySpec({ entityName: 'ProposalMediaFile', table: proposalMediaFiles, schemas: proposalMediaServerSpec.schemas, parent: { spec: proposalServerSpec, fk: proposalMediaFiles.proposalId, field: 'views' } })
// @ts-expect-error two sub-entities claim `views` under Proposal
export type DuplicateIsCaught = AssertNever<DuplicateFieldsIn<ServerSpecs | typeof secondViews>>
```

- [ ] **Step 2: Run the type-check and watch it fail**

Run: `pnpm tsc`
Expected: FAIL — `Cannot find module '@/shared/domains/permissions/specs'`.

- [ ] **Step 3: Create `src/shared/domains/permissions/specs.ts`**

```ts
// Types only, so client-safe modules may import this file without pulling server code.

import type { PgTable } from 'drizzle-orm/pg-core'

import type { appSettingServerSpec } from '@/shared/entities/app-settings/lib/server-spec'
import type { applicationServerSpec } from '@/shared/entities/applications/lib/server-spec'
import type { customerNoteServerSpec } from '@/shared/entities/customer-notes/lib/server-spec'
import type { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import type { leadSourceServerSpec } from '@/shared/entities/lead-sources/lib/server-spec'
import type { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
import type { voipCallServerSpec } from '@/shared/entities/voip-calls/lib/server-spec'
import type { voipCampaignContactServerSpec } from '@/shared/entities/voip-campaign-contacts/lib/server-spec'
import type { voipCampaignServerSpec } from '@/shared/entities/voip-campaigns/lib/server-spec'
import type { voipContactFieldServerSpec } from '@/shared/entities/voip-contact-fields/lib/server-spec'
import type { voipDidServerSpec } from '@/shared/entities/voip-dids/lib/server-spec'
import type { voipLinkTokenServerSpec } from '@/shared/entities/voip-link-tokens/lib/server-spec'
import type { voipMessageServerSpec } from '@/shared/entities/voip-messages/lib/server-spec'
import type { projectServerSpec } from '@/shared/modules/projects/core/server-spec'
import type { projectMediaServerSpec } from '@/shared/modules/projects/media/server-spec'
import type { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import type { proposalIncentiveServerSpec } from '@/shared/modules/proposals/incentives/server-spec'
import type { proposalMediaServerSpec } from '@/shared/modules/proposals/media/server-spec'
import type { proposalViewServerSpec } from '@/shared/modules/proposals/views/server-spec'

/** Every spec. A spec missing here is invisible to rule typing. */
export type ServerSpecs
  = | typeof appSettingServerSpec
    | typeof applicationServerSpec
    | typeof customerNoteServerSpec
    | typeof customerServerSpec
    | typeof leadSourceServerSpec
    | typeof meetingServerSpec
    | typeof projectMediaServerSpec
    | typeof projectServerSpec
    | typeof proposalIncentiveServerSpec
    | typeof proposalMediaServerSpec
    | typeof proposalServerSpec
    | typeof proposalViewServerSpec
    | typeof voipCallServerSpec
    | typeof voipCampaignContactServerSpec
    | typeof voipCampaignServerSpec
    | typeof voipContactFieldServerSpec
    | typeof voipDidServerSpec
    | typeof voipLinkTokenServerSpec
    | typeof voipMessageServerSpec

type EntitySpecs = Extract<ServerSpecs, { subject: string }>
type ColumnKey<TTable extends PgTable> = keyof TTable['$inferSelect'] & string

export type EntitySubject = EntitySpecs['subject']
export type SpecOf<S extends EntitySubject> = Extract<EntitySpecs, { subject: S }>
export type RowOf<S extends EntitySubject> = SpecOf<S>['table']['$inferSelect']
export type ConditionColumnOf<S extends EntitySubject> = SpecOf<S>['conditionColumns'][number]

type SubEntitiesOf<TParent> = ServerSpecs extends infer TSpec
  ? TSpec extends { parent: { spec: TParent, field: string } } ? TSpec : never
  : never

type SubEntityPath<TParent> = SubEntitiesOf<TParent> extends infer TChild
  ? TChild extends { table: infer TTable extends PgTable, parent: { field: infer TField extends string } }
    ? TField | `${TField}.*` | `${TField}.**` | `${TField}.${ColumnKey<TTable>}` | `${TField}.${SubEntityPath<TChild>}`
    : never
  : never

/** What a rule may list as a field of `S`: its columns, and every sub-entity path under it. */
export type FieldOf<S extends EntitySubject> = ColumnKey<SpecOf<S>['table']> | SubEntityPath<SpecOf<S>>

type IsUnion<T, U = T> = T extends unknown ? ([U] extends [T] ? false : true) : never

/** The field names claimed by more than one sub-entity of the same parent; `never` when there are none. */
export type DuplicateFieldsIn<TSpecs, TAll = TSpecs> = TSpecs extends { parent: { spec: infer TParent, field: infer TField extends string } }
  ? IsUnion<Extract<TAll, { parent: { spec: TParent, field: TField } }>> extends true ? TField : never
  : never
```

- [ ] **Step 4: Run the type-check and watch it pass**

Run: `pnpm tsc`
Expected: no errors. In particular no `TS2578: Unused '@ts-expect-error' directive` — one would mean a check is not rejecting what it must.

- [ ] **Step 5: Prove a line is live**

Temporarily change `'veiws'` to `'views'` on the `fieldTypo` line and run `pnpm tsc`.
Expected: FAIL with `TS2578` on the line above it. Change it back and run `pnpm tsc` again: no errors.

- [ ] **Step 6: Lint and commit**

Run: `pnpm lint`
Expected: no error outside `src/app/(frontend)/globals.css`.

```bash
git add -- src/shared/domains/permissions/specs.ts src/shared/domains/permissions/type-checks/must-not-compile.ts
git commit -m "feat(permissions): type-only list of specs with derived subjects, rows and fields

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push origin refactor/285-refactor-permissions-casl-scope-compiler
```

---

### Task 3: Operator declarations and `defineRules`

**Files:**
- Modify: `src/shared/domains/permissions/type-checks/must-not-compile.ts` (append)
- Create: `src/shared/domains/permissions/operators.ts`
- Create: `src/shared/domains/permissions/rules/define-rules.ts`

**Interfaces:**
- Consumes: `EntitySubject`, `RowOf`, `ConditionColumnOf`, `FieldOf` from Task 2; `Pipeline` from `@/shared/constants/enums/pipelines`.
- Produces: `OPERATOR_NAMES`, `ReadOperators` (from `…/permissions/operators`); `defineRules(build: (can: AddRule, cannot: AddCannotRule) => void): PermissionRule[]`, `PermissionRule`, `AddRule`, `AddCannotRule` (from `…/permissions/rules/define-rules`).

- [ ] **Step 1: Append the rule lines to `must-not-compile.ts`**

Add `import { defineRules } from '@/shared/domains/permissions/rules/define-rules'` to the value imports (sorted), then append:

```ts
// ── rules ──────────────────────────────────────────────────────────────────

const userId = 'user-1'
const proposalId = 'proposal-1'
const conditionsBuiltElsewhere = { token: 'x' }
const operatorBuiltElsewhere = { $participatesViaMeeting: { via: 'customerId' as const, userId } }

export const rulesThatMustCompile = defineRules((can, cannot) => {
  can('manage', 'all')
  can('access', 'Dashboard')
  can('own', 'Meeting')
  can('read', 'User')
  can(['read', 'create', 'update', 'delete'], 'Activity')

  can('read', 'Customer', { $participatesViaMeeting: { via: 'customerId', userId } })
  can('read', 'Customer', { $inDerivedPipeline: ['leads', 'rehash', 'dead', 'fresh'] })
  can('update', 'Customer', ['age'])
  can('update', 'Customer', ['name', 'phone', 'email', 'address', 'city', 'state', 'zip', 'pipelineStage'])

  can('read', 'Proposal', { id: proposalId })
  can('update', 'Proposal', ['financeOptionId', 'cashInDealCents', 'views'], { id: proposalId })
  can('read', 'Proposal', { $participatesViaMeeting: { via: 'meetingId', userId } })
  cannot('update', 'Proposal', ['incentives', 'incentives.*'], { id: proposalId })

  can('read', 'Meeting', { $participatesViaMeeting: { via: 'self', userId } })
  can('read', 'Project', { $participatesViaMeeting: { via: 'projectId', userId } })
  can('read', 'Project', { ownerId: userId })
  can(['update', 'delete'], 'CustomerNote', { authorId: userId })
  can('read', 'VoipCall', { agentUserId: { $in: [userId] } })
  can('read', 'Customer', operatorBuiltElsewhere)
  can('update', 'Proposal', ['views'])
  cannot('delete', 'CustomerNote')
}).length

defineRules((can, cannot) => {
  // @ts-expect-error typo in a field
  can('update', 'Customer', ['agee'])
  // @ts-expect-error typo in a field of a cannot: the restriction would silently not apply
  cannot('update', 'Proposal', ['incentivs'], { id: proposalId })
  // @ts-expect-error a Proposal field named on Customer
  can('update', 'Customer', ['views'])
  // @ts-expect-error not a column of the sub-entity's table
  can('update', 'Proposal', ['views.nope'])
  // @ts-expect-error a condition on a column that is not a declared condition column
  can('update', 'Proposal', { token: 'x' })
  // @ts-expect-error a condition value of the wrong type
  can('read', 'Proposal', { id: 42 })
  // @ts-expect-error an operator on a mutation rule
  can('update', 'Customer', { $participatesViaMeeting: { via: 'customerId', userId } })
  // @ts-expect-error an operator together with a field list
  can('read', 'Customer', ['age'], { $participatesViaMeeting: { via: 'customerId', userId } })
  // @ts-expect-error an operator on a cannot
  cannot('read', 'Customer', { $participatesViaMeeting: { via: 'customerId', userId } })
  // @ts-expect-error an operator that this subject does not declare
  can('read', 'Proposal', { $inDerivedPipeline: ['leads'] })
  // @ts-expect-error a `via` this subject's table cannot join through
  can('read', 'Customer', { $participatesViaMeeting: { via: 'meetingId', userId } })
  // @ts-expect-error not a pipeline
  can('read', 'Customer', { $inDerivedPipeline: ['nope'] })
  // @ts-expect-error an action that does not exist for an entity
  can('access', 'Customer')
  // @ts-expect-error `own` is declared for Meeting only
  can('own', 'Proposal')
  // @ts-expect-error unknown subject
  can('read', 'Custmer')
  // @ts-expect-error a subject without a spec takes no fields
  can('read', 'User', ['name'])
  // @ts-expect-error a subject without a spec takes no conditions
  can('read', 'User', { id: userId })

  // An entity with no condition columns has an empty conditions type; an empty type must not accept everything.
  // @ts-expect-error no condition columns: no conditions on a mutation
  can('update', 'Application', { anything: 1 })
  // @ts-expect-error no condition columns and no operator: no conditions on a read
  can('read', 'Application', { anything: 1 })
  // @ts-expect-error an unknown key beside a valid operator
  can('read', 'Customer', { $participatesViaMeeting: { via: 'customerId', userId }, extra: 1 })
  // @ts-expect-error conditions built elsewhere are checked too: undeclared column
  can('update', 'Proposal', conditionsBuiltElsewhere)
  // @ts-expect-error conditions built elsewhere are checked too: operator on a mutation
  can('update', 'Customer', operatorBuiltElsewhere)
  // @ts-expect-error a field list is never read as conditions
  can('update', 'Proposal', ['veiws'])
  // @ts-expect-error a field list is never read as conditions (cannot)
  cannot('update', 'Proposal', ['veiws'])
})
```

- [ ] **Step 2: Run the type-check and watch it fail**

Run: `pnpm tsc`
Expected: FAIL — `Cannot find module '@/shared/domains/permissions/rules/define-rules'`.

- [ ] **Step 3: Create `src/shared/domains/permissions/operators.ts`**

```ts
import type { Pipeline } from '@/shared/constants/enums/pipelines'

// The names are the contract between the rules (client-safe) and the SQL bodies (server-only).
export const OPERATOR_NAMES = ['participatesViaMeeting', 'inDerivedPipeline'] as const
export type OperatorName = (typeof OPERATOR_NAMES)[number]

/**
 * Which operator a `read` rule may carry, per subject. `via` names the path from that
 * subject's table to `meeting_participants`; a subject is listed only with a path its table has.
 */
export interface ReadOperators {
  Customer: {
    $participatesViaMeeting?: { via: 'customerId', userId: string }
    $inDerivedPipeline?: readonly Pipeline[]
  }
  Meeting: { $participatesViaMeeting?: { via: 'self', userId: string } }
  Proposal: { $participatesViaMeeting?: { via: 'meetingId', userId: string } }
  Project: { $participatesViaMeeting?: { via: 'projectId', userId: string } }
}
```

- [ ] **Step 4: Create `src/shared/domains/permissions/rules/define-rules.ts`**

```ts
import type { MongoAbility, RawRuleOf } from '@casl/ability'

import type { ReadOperators } from '@/shared/domains/permissions/operators'
import type { ConditionColumnOf, EntitySubject, FieldOf, RowOf } from '@/shared/domains/permissions/specs'

export type PermissionRule = RawRuleOf<MongoAbility>

type CrudAction = 'create' | 'delete' | 'read' | 'update'

/** Subjects that have no spec: feature gates, and entities whose table has none yet. Verbs only. */
interface SubjectsWithoutSpec {
  all: 'manage'
  Dashboard: 'access'
  Calendar: 'manage'
  CustomerPipeline: 'read'
  LeadsPool: 'read'
  User: 'read'
  Activity: CrudAction
}

/** Capabilities on an entity that are not about a row. */
interface ExtraEntityActions {
  Meeting: 'own'
}

// Equality and `$in` are the two forms the SQL compiler turns into a filter.
type ColumnConditions<S extends EntitySubject> = {
  [K in ConditionColumnOf<S> & keyof RowOf<S>]?: RowOf<S>[K] | { $in: readonly NonNullable<RowOf<S>[K]>[] }
}
type ReadOperatorsOf<S extends EntitySubject> = S extends keyof ReadOperators ? ReadOperators[S] : unknown
type ReadConditions<S extends EntitySubject> = ColumnConditions<S> & ReadOperatorsOf<S>

/** An array has an iterator and a conditions object does not; without this a field list can be read as conditions. */
interface NotAList {
  readonly [Symbol.iterator]?: never
}

// An entity with no condition columns has an EMPTY conditions type, and an empty object type
// accepts any object. So the given conditions are captured as `TGiven` and every key outside
// `TAllowed` is turned into `never`. The no-extra-keys branch returns `TGiven` untouched because
// intersecting with `{}` would switch off the "no properties in common" check.
type Only<TGiven, TAllowed> = ([Exclude<keyof TGiven, keyof TAllowed>] extends [never]
  ? TGiven
  : TGiven & { [K in Exclude<keyof TGiven, keyof TAllowed>]: never }) & NotAList

interface RuleHandle {
  because: (reason: string) => void
}

export interface AddCannotRule {
  <S extends EntitySubject, C extends ColumnConditions<S>>(action: CrudAction | readonly CrudAction[], subject: S, conditions?: Only<C, ColumnConditions<S>>): RuleHandle
  <S extends EntitySubject, C extends ColumnConditions<S>>(action: CrudAction | readonly CrudAction[], subject: S, fields: readonly FieldOf<S>[], conditions?: Only<C, ColumnConditions<S>>): RuleHandle
}

export interface AddRule {
  /** The only form that may carry an operator: `read`, no field list. Operators are SQL-only, so a client cannot test them on a row. */
  <S extends EntitySubject, C extends ReadConditions<S>>(action: 'read', subject: S, conditions?: Only<C, ReadConditions<S>>): RuleHandle
  <S extends EntitySubject, C extends ColumnConditions<S>>(action: Exclude<CrudAction, 'read'> | readonly CrudAction[], subject: S, conditions?: Only<C, ColumnConditions<S>>): RuleHandle
  <S extends EntitySubject, C extends ColumnConditions<S>>(action: CrudAction | readonly CrudAction[], subject: S, fields: readonly FieldOf<S>[], conditions?: Only<C, ColumnConditions<S>>): RuleHandle
  <S extends keyof ExtraEntityActions>(action: ExtraEntityActions[S], subject: S): RuleHandle
  <S extends keyof SubjectsWithoutSpec>(action: SubjectsWithoutSpec[S] | readonly SubjectsWithoutSpec[S][], subject: S): RuleHandle
}

function ruleAdder(rules: PermissionRule[], inverted: boolean) {
  return (action: unknown, subject: unknown, fieldsOrConditions?: unknown, maybeConditions?: unknown): RuleHandle => {
    const fields = Array.isArray(fieldsOrConditions) ? fieldsOrConditions : undefined
    const conditions = Array.isArray(fieldsOrConditions) ? maybeConditions : fieldsOrConditions
    const rule = {
      action,
      subject,
      ...(fields ? { fields } : {}),
      ...(conditions ? { conditions } : {}),
      ...(inverted ? { inverted } : {}),
    } as PermissionRule
    rules.push(rule)
    return {
      because: (reason) => {
        rule.reason = reason
      },
    }
  }
}

/** Typed `can` / `cannot`. The result is plain CASL rule data, so it can be sent to the client as it is. */
export function defineRules(build: (can: AddRule, cannot: AddCannotRule) => void): PermissionRule[] {
  const rules: PermissionRule[] = []
  build(ruleAdder(rules, false) as AddRule, ruleAdder(rules, true) as AddCannotRule)
  return rules
}
```

- [ ] **Step 5: Run the type-check and watch it pass**

Run: `pnpm tsc`
Expected: no errors, and no `TS2578`.

If a line under `rulesThatMustCompile` reports "No overload matches this call", the types are too strict: fix `define-rules.ts`, never the fixture. If a `@ts-expect-error` line reports `TS2578`, the types are too loose: check first that no generic fell back to `string` (hover `FieldOf<'Customer'>`; it must be a union of literals), then that `Only<>` and `NotAList` are intact.

- [ ] **Step 6: Prove two lines are live**

Temporarily change `['incentivs']` to `['incentives']` in the `cannot` line and run `pnpm tsc`. Expected: `TS2578` on the line above. Change it back.
Temporarily delete the `// @ts-expect-error an operator on a mutation rule` comment and run `pnpm tsc`. Expected: an error on the `can('update', 'Customer', { $participatesViaMeeting … })` line. Restore the comment. Run `pnpm tsc`: no errors.

- [ ] **Step 7: Lint and commit**

Run: `pnpm lint`
Expected: no error outside `src/app/(frontend)/globals.css`.

```bash
git add -- src/shared/domains/permissions/operators.ts src/shared/domains/permissions/rules/define-rules.ts src/shared/domains/permissions/type-checks/must-not-compile.ts
git commit -m "feat(permissions): typed can and cannot (defineRules) and operator declarations

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push origin refactor/285-refactor-permissions-casl-scope-compiler
```

---

### Task 4: Close-out

**Files:**
- Modify: `docs/plans/2026-08-10-casl-scope-compiler-epic.md` (unit 1 checkbox and plan pointer; Appendix A)
- Modify: `docs/plans/2026-09-07-casl-re-grounding/DISTILLED-2026-10-01.md` (§1 status, §7 next steps)

- [ ] **Step 1: The list is complete**

Run:
```bash
git grep -c "defineEntitySpec(\|defineSubEntitySpec(" -- 'src/**/server-spec.ts' | wc -l
grep -c "| typeof " src/shared/domains/permissions/specs.ts
```
Expected: `19` and `19`.

- [ ] **Step 2: The client-safe files import specs and tables as types only**

Run: `grep -n "^import [^t]" src/shared/domains/permissions/specs.ts src/shared/domains/permissions/operators.ts src/shared/domains/permissions/rules/define-rules.ts`
Expected: no output.

Run: `git grep -n "type-checks/must-not-compile" -- src`
Expected: no output (nothing imports the file).

- [ ] **Step 3: Enforcement is untouched**

Run: `git diff --stat main -- src/shared/domains/permissions/abilities.ts src/shared/dal/server/lib/scope.ts src/trpc/lib/middleware src/trpc/init.ts`
Expected: no output.

Run: `git diff main -- src/trpc/lib/create-crud-router.ts | grep "^[+-]" | grep -v "^+++\|^---"`
Expected: exactly five lines — one added import and the two `spec.caslSubject` → `subjectOf(spec)` replacements.

- [ ] **Step 4: Full verification and timing**

Run: `pnpm tsc && pnpm lint` and time a second, warm `pnpm tsc`.
Expected: type-check clean; no lint error outside `globals.css`; warm type-check within about 20% of the 12 s baseline. If it is slower than that, report the number instead of optimising.

- [ ] **Step 5: Update the tracker and the distilled record**

In `docs/plans/2026-08-10-casl-scope-compiler-epic.md`:
- §4: in the Unit 1 item, change `- [ ]` to `- [x]`, change `· AFK.` to `· DONE <today's date>.`, and replace the `**Plan:** _(to write)_` line with `**Landed as:**` followed by the three commit hashes of Tasks 1–3.
- §5.4: delete the table row whose first cell is "`caslSubject` on the spec".
- Appendix A: append this line, with today's date:

```markdown
- **<date>** — Unit 1 landed: specs are built by `defineEntitySpec` / `defineSubEntitySpec`; `permissions/specs.ts` derives subjects, rows and fields; `defineRules` and the operator declarations exist unwired; `type-checks/must-not-compile.ts` guards the types.
```

In `docs/plans/2026-09-07-casl-re-grounding/DISTILLED-2026-10-01.md`:
- §1: add this bullet:

```markdown
- Unit 1 (typed foundation) is in the tree: spec constructors, the type-only list, `defineRules`. Rules and enforcement are still the legacy engine's.
```

- §7: replace step 2 with:

```markdown
2. Write the plan for unit 2 (one actor per request) for the owner's approval.
```

The plan file itself is deleted in the next step, per the repo rule that a plan is deleted when it ships.

- [ ] **Step 6: Commit, then bring main in**

```bash
git add -- docs/plans/2026-08-10-casl-scope-compiler-epic.md docs/plans/2026-09-07-casl-re-grounding/DISTILLED-2026-10-01.md
git rm -q docs/superpowers/plans/2026-10-05-permissions-unit-1-typed-foundation.md
git commit -m "docs(permissions): unit 1 (typed foundation) landed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git merge --no-ff main
pnpm tsc && pnpm lint
git push origin refactor/285-refactor-permissions-casl-scope-compiler
```

If the merge brings a new or moved `server-spec.ts` from main, convert it with the Task 1 rule, add it to `ServerSpecs`, and re-run Step 1 with the new count before pushing.
