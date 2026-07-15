# Wave 1 Child-Table Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rework the Wave-1 branch from wide-table flattening to the Sub-Entity Standard (spec Addendum B): the customers profile trio becomes ONE `customer_profiles` child table (all trio fields except `age`); the agentProfile and voipConfig cutovers stand as built; the notion snapshot ceremony is deleted.

**Architecture:** Additive child table first → backfill retarget → consumer flip + column removal → docs/runbook. Prod never saw the wide table, so prod migrates once (blobs → child table) at cutover.

**Spec:** `docs/superpowers/specs/2026-07-09-jsonb-decomposition-program-design.md` §10 Addendum B (authoritative for every decision here). Epic #256, issue #259, PR #260.

## Global Constraints

- All Wave-1 Global Constraints from `docs/superpowers/plans/2026-07-13-wave-1-zero-table-wins.md` apply verbatim (tsc+lint only; db:push:dev only; pathspec staging; pgEnum-from-const; house DAL rules).
- **`age` STAYS a column on `customers`** — do not move it. Homeowner contracts flow + envelope rules depend on parent placement (Addendum B.2).
- The 23 moved fields (24 minus age): triggerEvent, mainPainAccessor, mainPainUrgency, additionalPainPoints, outcomePriority, timeInHome, householdType, priorContractorExperience, constructionOutlookFavorabilityRating, sellPlan, decisionTimeline, projectNecessityRating, ageGroup · hoa, yearBuilt, roofType, foundationType, hvacType, hvacComponents, windowsType, insulationLevel · numQuotesReceived, creditScore.
- 1:1 idiom: PK-as-FK + `onDelete: 'cascade'` (`voip_campaign_contacts` precedent). Lazy upsert (row-exists = discovery collected). Reads = flattened-spread leftJoin.
- Hard type rule: profile consumers accept the composed type or `CustomerProfileRow | null` — NEVER `Partial` field-spreads that compile when the join is missing.
- user/agentProfile columns and lead_sources voip columns are FROZEN AS BUILT — do not touch.
- Every task ends `pnpm tsc` + `pnpm lint` green.

---

### Task R1: `customer_profiles` schema (additive)

**Files:** Create `src/shared/db/schema/customer-profiles.ts`; modify `src/shared/db/schema/index.ts` (export).

**Produces:** `customerProfiles` table, `CustomerProfileRow` select type, `customerProfilePatchSchema`, `insertCustomerProfileSchema`.

- [ ] Step 1: schema file:

```ts
import type z from 'zod'
import { boolean, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { painSchema } from '@/shared/entities/customers/schemas'
import { CUSTOMER_AGE_MIN } from '@/shared/entities/customers/lib/constants' // only if needed; age NOT here
import { createdAt, updatedAt } from '../lib/schema-helpers'
import { customers } from './customers'
import {
  creditScoreRangeEnum, customerAgeGroupEnum, decisionTimelineEnum,
  foundationTypeEnum, householdTypeEnum, hvacComponentEnum, hvacTypeEnum,
  insulationLevelEnum, outcomePriorityEnum, priorContractorExperienceEnum,
  roofTypeEnum, sellPlanEnum, triggerEventEnum, windowsTypeEnum,
  yearBuiltRangeEnum, yearsInHomeEnum,
} from './meta'
import type { Pain } from '@/shared/entities/customers/schemas'

// 1:1 sales-discovery profile. Row-exists = discovery data has been collected
// (lazy upsert; ~18% of customers). `age` deliberately lives on customers —
// written by anonymous homeowners (contracts flow), read by envelope rules.
// see docs/superpowers/specs/2026-07-09-jsonb-decomposition-program-design.md §10
export const customerProfiles = pgTable('customer_profiles', {
  customerId: uuid('customer_id').primaryKey()
    .references(() => customers.id, { onDelete: 'cascade' }),
  // ── customer-profile section ──
  triggerEvent: triggerEventEnum('trigger_event'),
  mainPainAccessor: text('main_pain_accessor'),
  mainPainUrgency: integer('main_pain_urgency'),
  // identity-free value array, replaced whole, never SQL-queried (sanctioned
  // JSONB, promotion trigger documented in customers/DOCS.md)
  additionalPainPoints: jsonb('additional_pain_points').$type<Pain[]>(),
  outcomePriority: outcomePriorityEnum('outcome_priority'),
  timeInHome: yearsInHomeEnum('time_in_home'),
  householdType: householdTypeEnum('household_type'),
  priorContractorExperience: priorContractorExperienceEnum('prior_contractor_experience'),
  constructionOutlookFavorabilityRating: integer('construction_outlook_favorability_rating'),
  sellPlan: sellPlanEnum('sell_plan'),
  decisionTimeline: decisionTimelineEnum('decision_timeline'),
  projectNecessityRating: integer('project_necessity_rating'),
  ageGroup: customerAgeGroupEnum('age_group'),
  // ── property section ──
  hoa: boolean('hoa'),
  yearBuilt: yearBuiltRangeEnum('year_built'),
  roofType: roofTypeEnum('roof_type'),
  foundationType: foundationTypeEnum('foundation_type'),
  hvacType: hvacTypeEnum('hvac_type'),
  hvacComponents: hvacComponentEnum('hvac_components'),
  windowsType: windowsTypeEnum('windows_type'),
  insulationLevel: insulationLevelEnum('insulation_level'),
  // ── financial section ──
  numQuotesReceived: integer('num_quotes_received'),
  creditScore: creditScoreRangeEnum('credit_score'),
  createdAt,
  updatedAt,
})

export const selectCustomerProfileSchema = createSelectSchema(customerProfiles)
export type CustomerProfileRow = z.infer<typeof selectCustomerProfileSchema>

export const insertCustomerProfileSchema = createInsertSchema(customerProfiles, {
  additionalPainPoints: z.array(painSchema).nullable().optional(),
  mainPainUrgency: z.number().int().min(1).max(10).nullable().optional(),
  constructionOutlookFavorabilityRating: z.number().int().min(1).max(10).nullable().optional(),
  projectNecessityRating: z.number().int().min(1).max(10).nullable().optional(),
  numQuotesReceived: z.number().int().min(0).nullable().optional(),
}).omit({ createdAt: true, updatedAt: true })

// Wire patch: undefined = untouched, null = clear. No pick(), no import-cycle exile.
export const customerProfilePatchSchema = insertCustomerProfileSchema
  .omit({ customerId: true })
  .partial()
export type CustomerProfilePatch = z.infer<typeof customerProfilePatchSchema>
```
(Adjust the unused CUSTOMER_AGE_MIN import out; match import idioms; `z` must be a value import.)

- [ ] Step 2: export from `src/shared/db/schema/index.ts`; `pnpm db:push:dev` (additive: 1 table); `pnpm tsc && pnpm lint`; commit pathspec.

---

### Task R2: backfill retarget + snapshot-prod-to-dev

**Files:** Modify `scripts/backfill-wave1-columns.ts` (customers section), `scripts/snapshot-prod-to-dev.ts`.

- [ ] Step 1: `backfillCustomers` now writes: `age` → `customers.age` (plain update, unchanged mechanism) AND the 23 fields → `customerProfiles` via `db.insert(customerProfiles).values({customerId: row.id, ...patch23}).onConflictDoUpdate({target: customerProfiles.customerId, set: patch23})`. Skip child insert entirely when all 23 mapped values are null (preserve row-exists semantics: blob-empty customers get NO child row — adjust the skip logic so a blob containing ONLY `age` writes customers.age but no child row). Parity: re-read child row (or assert absence) + customers.age; diff per field. LEGACY_ENUM_MAP + normalizeLegacyEnums + Zod gates unchanged. users/lead_sources sections unchanged.
- [ ] Step 2: `snapshot-prod-to-dev.ts`: add `def({ table: schema.customerProfiles })` AFTER the customers entry (FK order); verify how TRUNCATE_ROOTS handles cascade (customer_profiles cascades from customers — confirm and note).
- [ ] Step 3: run dry-run + live + live (idempotency) against worktree DB — `mismatches=0 errors=0`, exactly 7 ↷ legacy lines, and report the child-row count vs skipped. tsc/lint. Commit.

---

### Task R3: the flip — DAL, CASL, routers, clients, column removal

**Files:** Create `src/shared/dal/server/lib/upsert-one-to-one.ts`, modify `src/shared/entities/customers/dal/server/mutations.ts` (+queries), `src/shared/db/schema/customers.ts` (REMOVE the 23 columns; KEEP age + deprecated blobs; remove `profileColumnsPatchSchema` + `PROFILE_COLUMNS_PICK`), `src/shared/entities/customers/schemas/index.ts` (COLUMN_KEYS rework), `src/shared/domains/permissions/abilities.ts`, entity constants (`ENTITY_NAMES`/subjects — find via `rg "AppSubject|ENTITY_NAMES" src/shared/domains/permissions`), `src/trpc/routers/meeting-flow.router.ts`, `src/shared/entities/customers/hooks/use-customer-edit-form.ts`, `src/shared/entities/customers/lib/{build-customer-form-defaults,customer-predicates,pick-profile-columns}.ts`, `src/features/meeting-flow/lib/{context-fill-count,build-persona-profile}.ts`, `src/features/customer-pipelines/dal/server/get-customer-profile.ts`, `src/shared/entities/meetings/dal/server/queries.ts` (getByIdWithJoins), `src/shared/entities/customers/dal/server/queries.ts`, `src/shared/hooks/use-invalidation.ts` (or wherever invalidation maps live), `src/trpc/routers/customers.router/index.ts` (stale comments), display components as types demand.

Key shapes:

- [ ] Step 1: generic helper `upsertOneToOne(table, fkColumn, parentId, set)` (~30 lines): filters undefined, throws precondition-failed on empty set, `insert…onConflictDoUpdate…returning`.
- [ ] Step 2: business-DAL mutation in customers `mutations.ts`:
```ts
export async function upsertCustomerProfile(
  ctx: ScopedContext,
  input: { customerId: string, patch: CustomerProfilePatch },
): Promise<DalReturn<CustomerProfileRow>> {
  return dalDbOperation(async () => {
    const validated = customerProfilePatchSchema.parse(input.patch)
    // visibility guard: scope predicates reference customers, not the child
    if (ctx.scope) {
      const [parent] = await db.select({ id: customers.id }).from(customers)
        .where(and(eq(customers.id, input.customerId), ctx.scope)).limit(1)
      if (!parent) throw new ThrowableDalError({ type: 'not-found' })
    }
    return upsertOneToOne(customerProfiles, customerProfiles.customerId, input.customerId, validated)
  })
}
```
(match house error/DalReturn idioms — read mutations.ts first.)
- [ ] Step 3: reads — flattened-spread join in the THREE full-row sites: customers `queries.ts` getCustomer (+ list if it returns full rows), `get-customer-profile.ts:29` (customer-pipelines), meetings `getByIdWithJoins` nested-customer projection. `profileCols()` helper strips fk/timestamps via `getTableColumns(customerProfiles)`. Composed type `CustomerWithProfile = CustomerWithPhoneGate & { [K in ProfileKey]: CustomerProfileRow[K] | null }` exported from customers entity; consumers re-typed. `age` needs NO join anywhere (parent column).
- [ ] Step 4: COLUMN_KEYS rework in `schemas/index.ts`: the three grouped display constants now list CHILD keys (unchanged strings, minus `age` from CUSTOMER_PROFILE_COLUMN_KEYS — decide `age` display placement: keep `age` rendered where it is today by reading `customer.age`; check `*_PROFILE_FIELDS` — age has no display entry, so likely zero UI change). `PROFILE_COLUMN_KEYS` (flat union) should now derive: `Object.keys(getTableColumns(customerProfiles)).filter(k => !['customerId','createdAt','updatedAt'].includes(k))` — or stay literal if the derived form fights tsc; note the choice.
- [ ] Step 5: CASL — add `CustomerProfile` subject (ENTITY_NAMES + AppSubject union); `abilities.ts` agent: REMOVE `can('update','Customer',[...PROFILE_COLUMN_KEYS])` + its import, ADD `can('read','CustomerProfile')`, `can('update','CustomerProfile')`, `can('update','Customer',['age'])`. Dispatcher unchanged (reads stay status quo). Router: meeting-flow `updateCustomerProfile` input `{meetingId, customerId, patch: customerProfilePatchSchema}` → asserts `can('update','CustomerProfile')` (agentProcedure + explicit assert; mirror existing assert idiom) → `upsertCustomerProfile` (+ separate `customerCrud.update({age})` ONLY if patch carries age — it won't; age edits come from edit form/contracts). Edit form: dirty-diff splits into `{age?}` → crud.update AND profile keys → new `customersRouter.profile.upsert` procedure (add it to customers router, slot-level CASL on CustomerProfile); client probe `ability.can('update','CustomerProfile')`; wire invalidation for the new procedure per participant-invalidation rule. Contracts age-patch: UNTOUCHED.
- [ ] Step 6: remove the 23 columns from `customers.ts` (KEEP `age`, deprecated blobs, and their Zod override for age); delete `profileColumnsPatchSchema`/`PROFILE_COLUMNS_PICK`; `pnpm db:push:dev` (drops 23 columns + enums stay); fix every tsc error EXCEPT files owned by other tasks (backfill script already retargeted in R2 — reconcile if tsc disagrees).
- [ ] Step 7: full gates + sanity: `pnpm tsc && pnpm lint`; `rg "PROFILE_COLUMN_KEYS" src/shared/domains/permissions` → empty; `pnpm tsx scripts/backfill-wave1-columns.ts --dry-run` exit 0. Commit.

---

### Task R4: docs, conventions, runbook, notion-cleanup

**Files:** Modify `docs/adr/0005-jsonb-vs-column-vs-child-table.md` (amended-by note + the B.1 rule), `docs/codebase-conventions/jsonb-columns.md` (add the sub-entity decision tree + smell test; keep anchors), `docs/codebase-conventions/dal-conventions.md` (new `### one-to-one-child-tables` section: PK-as-FK, upsertOneToOne, flattened-spread reads, composed-type hard rule, duplicate-slot caveat, scope guard), `src/shared/entities/customers/DOCS.md` (profile section → child table; promotion trigger note for additionalPainPoints), `src/trpc/DOCS.md` (CASL example → CustomerProfile subject), `src/trpc/routers/customers.router/index.ts` comments if not done in R3, `docs/superpowers/plans/2026-07-13-wave-1-cutover-runbook.md` (rewrite: child-table shapes; **DELETE the entire notion snapshot pre-flight step**; note the expected prod push plan now includes CREATE TABLE customer_profiles and the notion_contact_id DROP with NO snapshot required; keep drizzle-override + legacy-map + users-rehearsal gates), DELETE `scripts/snapshot-notion-contact-ids.ts`.

- [ ] Step 1: make the edits; every touched heading keeps its slug byte-identical; grep inbound anchors.
- [ ] Step 2: `pnpm tsc && pnpm lint`; commit (include the deletion via `git rm`).

---

Final: whole-branch review (most capable model) over the ENTIRE branch (06952187..HEAD — both the surviving wide-era commits and the rework), then update PR #260 title/body and lift the hold.
