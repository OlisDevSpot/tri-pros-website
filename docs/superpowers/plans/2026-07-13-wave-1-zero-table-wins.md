# Wave 1 — Zero-Table Wins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose three JSONB blobs into real columns (`customers` profile trio, `user.agentProfileJSON`, `lead_sources.voipConfigJSON` split), deregister `proposals` from `jsonbMergeColumns`, and fix the stale docs — killing both unprotected write races and 6 of 7 merge registrations with zero new tables.

**Architecture:** Additive schema first (new columns land beside the blobs), then a parity-checked backfill, then per-entity cutover releases that flip reads AND writes to columns while TS-deprecating the blobs. Follows spec §3 Wave 1 + §4 migration protocol. Epic #256, issue #259.

**Tech Stack:** Next.js 15, Drizzle (Postgres/Neon), Zod, tRPC, pnpm. Worktree via `pnpm dispatch start 259` (own Neon branch).

**Spec:** `docs/superpowers/specs/2026-07-09-jsonb-decomposition-program-design.md` (§2 verdicts, §3 Wave 1, §4 protocol)

## Global Constraints

- Verification = `pnpm tsc` + `pnpm lint` ONLY. NEVER `pnpm build`. No test runner exists in this repo.
- DB pushes: `pnpm db:push:dev` ONLY (worktree has its own Neon branch). NEVER `pnpm db:push` (prod) — prod push happens once, at cutover, run by a human per the §Cutover runbook.
- Stage commits explicitly by path. Never `git add -A`.
- Scripts start with `import './lib/load-env'` (never `'dotenv/config'`).
- Enum columns follow `docs/codebase-conventions/enum-standardization.md`: const array → type → **pgEnum in `src/shared/db/schema/meta.ts`** from the SAME const array. Columns use the pgEnum, not `text()`.
- Services orchestrate, DAL implements: no raw `db.insert/update` outside `dal/server/` files (Rule 19). The whole point of Task 4 is deleting one such violation — do not add new ones.
- No manual `updatedAt` in any `.set()` — `.$onUpdate()` handles it.
- Named exports only; no new files at entity root; `schemas/` is a sibling of `lib/`, never inside it.
- TS property names for new columns are IDENTICAL to today's blob field names (e.g. blob field `age` → column property `age`). This keeps `ProfileFieldConfig.id` accessors, form field names, and most reader expressions valid.
- **Deliberate protocol deviation (approved in plan review):** spec §4 says "old JSONB column renamed `*_deprecated`". We deprecate at the **TS level only** (Drizzle property renamed `*Deprecated`, DB column name unchanged, `@deprecated` JSDoc, zero writers) because `drizzle-kit push` handles column renames interactively (rename-vs-drop prompt) and a mis-answer drops prod data. The freeze + rollback intent is fully preserved; the column is dropped entirely one release later.
- The blobs stay readable this whole wave: sole permitted readers after cutover are the backfill/parity script and the deprecated Drizzle property. Zero writers after each cutover task.
- `customers.leadMetaJSON` stays REGISTERED in `jsonbMergeColumns` (Wave 2 handles it). Only the three profile blobs leave the customers registration.
- `additionalPainPoints`, `headshotCropData`, `messageTemplateOverrides`, `inHouse` stay JSONB per spec §2 (own columns where noted).

---

### Task 1: Schema — pgEnums + new columns (additive only)

**Files:**
- Modify: `src/shared/db/schema/meta.ts` (add 16 pgEnums)
- Modify: `src/shared/db/schema/customers.ts` (add 24 columns)
- Modify: `src/shared/db/schema/auth.ts` (add 8 columns to `user`)
- Modify: `src/shared/db/schema/lead-sources.ts` (add 6 columns)

**Interfaces:**
- Produces: pgEnums `triggerEventEnum, outcomePriorityEnum, yearsInHomeEnum, householdTypeEnum, priorContractorExperienceEnum, sellPlanEnum, decisionTimelineEnum, customerAgeGroupEnum, yearBuiltRangeEnum, creditScoreRangeEnum, roofTypeEnum, foundationTypeEnum, hvacTypeEnum, hvacComponentEnum, windowsTypeEnum, insulationLevelEnum`; new columns listed below, all with TS property names identical to blob field names. Tasks 2–5 consume these exact names.

- [ ] **Step 1: Add pgEnums to `src/shared/db/schema/meta.ts`**

Import the existing const arrays (source of truth — do NOT redeclare values):

```ts
import {
  creditScoreRanges,
  customerAgeGroups,
  decisionTimelines,
  householdTypes,
  outcomePriorities,
  priorContractorExperiences,
  sellPlans,
  triggerEvents,
  yearBuiltRanges,
  yearsInHomeRanges,
} from '@/shared/constants/enums/customers'
import {
  foundationTypes,
  hvacComponents,
  hvacTypes,
  insulationLevels,
  roofTypes,
  windowsTypes,
} from '@/shared/domains/construction/constants/enums'

export const triggerEventEnum = pgEnum('trigger_event', triggerEvents)
export const outcomePriorityEnum = pgEnum('outcome_priority', outcomePriorities)
export const yearsInHomeEnum = pgEnum('years_in_home', yearsInHomeRanges)
export const householdTypeEnum = pgEnum('household_type', householdTypes)
export const priorContractorExperienceEnum = pgEnum('prior_contractor_experience', priorContractorExperiences)
export const sellPlanEnum = pgEnum('sell_plan', sellPlans)
export const decisionTimelineEnum = pgEnum('decision_timeline', decisionTimelines)
export const customerAgeGroupEnum = pgEnum('customer_age_group', customerAgeGroups)
export const yearBuiltRangeEnum = pgEnum('year_built_range', yearBuiltRanges)
export const creditScoreRangeEnum = pgEnum('credit_score_range', creditScoreRanges)
export const roofTypeEnum = pgEnum('roof_type', roofTypes)
export const foundationTypeEnum = pgEnum('foundation_type', foundationTypes)
export const hvacTypeEnum = pgEnum('hvac_type', hvacTypes)
export const hvacComponentEnum = pgEnum('hvac_component', hvacComponents)
export const windowsTypeEnum = pgEnum('windows_type', windowsTypes)
export const insulationLevelEnum = pgEnum('insulation_level', insulationLevels)
```

Note: several labels contain spaces/en-dashes/apostrophes (`'Yes - good experience'`, `'1–3 months'`, `"Neighbor's project"`, `'600 – 700'`). Postgres enum labels accept all of these. Do NOT normalize values — the backfill must be a byte-identical copy.

- [ ] **Step 2: Add 24 columns to `customers` in `src/shared/db/schema/customers.ts`**

Insert after `financialProfileJSON` (line 27), before `leadSourceId`. Import `integer` from `drizzle-orm/pg-core`, `painSchema` + the new enums as needed:

```ts
  // ── Wave-1 decomposition: customerProfileJSON → columns (epic #256 / #259) ──
  triggerEvent: triggerEventEnum('trigger_event'),
  mainPainAccessor: text('main_pain_accessor'),
  mainPainUrgency: integer('main_pain_urgency'),
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
  age: integer('age'),
  // ── propertyProfileJSON → columns ──
  hoa: boolean('hoa'),
  yearBuilt: yearBuiltRangeEnum('year_built'),
  roofType: roofTypeEnum('roof_type'),
  foundationType: foundationTypeEnum('foundation_type'),
  hvacType: hvacTypeEnum('hvac_type'),
  hvacComponents: hvacComponentEnum('hvac_components'),
  windowsType: windowsTypeEnum('windows_type'),
  insulationLevel: insulationLevelEnum('insulation_level'),
  // ── financialProfileJSON → columns ──
  numQuotesReceived: integer('num_quotes_received'),
  creditScore: creditScoreRangeEnum('credit_score'),
```

`Pain` type: export it from `src/shared/entities/customers/schemas/index.ts` (`export type Pain = z.infer<typeof painSchema>`) if not already exported. All columns nullable (blob schemas are `.partial()` — absence is a legal state). `hoa` is nullable boolean (NULL = never answered, distinct from `false`).

Extend `insertCustomerSchema` overrides (keep existing blob overrides untouched this task):

```ts
  additionalPainPoints: z.array(painSchema).optional(),
  mainPainUrgency: z.number().int().min(1).max(10).optional(),
  constructionOutlookFavorabilityRating: z.number().int().min(1).max(10).optional(),
  projectNecessityRating: z.number().int().min(1).max(10).optional(),
  age: z.number().int().min(CUSTOMER_AGE_MIN).max(CUSTOMER_AGE_MAX).optional(),
  numQuotesReceived: z.number().int().min(0).optional(),
```

(imports: `z` becomes a value import; `painSchema` from entities schemas; `CUSTOMER_AGE_MIN/MAX` from `@/shared/entities/customers/lib/constants`.)

- [ ] **Step 3: Add 8 columns to `user` in `src/shared/db/schema/auth.ts`**

After `agentProfileJSON` (line 29):

```ts
  // ── Wave-1 decomposition: agentProfileJSON → columns (epic #256 / #259) ──
  quote: text('quote'),
  bio: text('bio'),
  yearsOfExperience: integer('years_of_experience'),
  tradeSpecialties: text('trade_specialties').array(),
  languagesSpoken: text('languages_spoken').array(),
  certifications: text('certifications').array(),
  headshotUrl: text('headshot_url'),
  // Stays JSONB per spec §2: single-writer, replaced-whole, two fixed sub-objects.
  headshotCropData: jsonb('headshot_crop_data').$type<AgentProfile['headshotCropData']>(),
```

(import `integer`, `jsonb` already imported; `AgentProfile` type already imported at top.)

- [ ] **Step 4: Add 6 columns to `lead_sources` in `src/shared/db/schema/lead-sources.ts`**

After `voipConfigJSON`:

```ts
  // ── Wave-1 decomposition: voipConfigJSON.campaigns → columns (epic #256 / #259) ──
  // Ownership semantics unchanged: policy is SOURCE-owned; campaigns stay pools.
  // Unset defaultCampaignId ⇒ auto-enroll inert (no guessing).
  // see src/shared/entities/lead-sources/DOCS.md
  voipCampaignsEnabled: boolean('voip_campaigns_enabled').notNull().default(true),
  voipAutoEnroll: boolean('voip_auto_enroll').notNull().default(false),
  defaultCampaignId: uuid('default_campaign_id').references((): AnyPgColumn => voipCampaignsTable.id, { onDelete: 'set null' }),
  dailyDialVolumeCap: integer('daily_dial_volume_cap'),
  messageTemplateOverridesJSON: jsonb('message_template_overrides_json').$type<Record<string, string>>(),
  // voip-in-house sub-object — dynamic template maps, correctly JSONB. Own column
  // so the two EPICs' writers never contend on one blob.
  voipInHouseConfigJSON: jsonb('voip_inhouse_config_json').$type<VoipInHousePolicy>(),
```

Imports: `integer`, `uuid`, `AnyPgColumn` (type) from `drizzle-orm/pg-core`; `VoipInHousePolicy` type from entities schemas; `voipCampaignsTable` from `./voip-campaigns`. **Circular-import check:** `voip-campaigns.ts` may import from `lead-sources.ts` — if so, the callback `references((): AnyPgColumn => ...)` form defers evaluation and tsc must stay green; if tsc reports a cycle error, declare the column WITHOUT `.references()` and add the FK via a `foreignKey()` in the table's third argument instead. Verify with `pnpm tsc`.

Also extend `insertLeadSourceSchema` — no override needed for the new columns (drizzle-zod derives), but confirm the generated schema accepts them.

- [ ] **Step 5: Push + verify**

```bash
pnpm db:push:dev
pnpm tsc && pnpm lint
```
Expected: push creates 16 enums + 38 columns, no drops, no prompts about renames (everything is additive). tsc/lint clean.

- [ ] **Step 6: Commit**

```bash
git add src/shared/db/schema/meta.ts src/shared/db/schema/customers.ts src/shared/db/schema/auth.ts src/shared/db/schema/lead-sources.ts src/shared/entities/customers/schemas/index.ts
git commit -m "feat(schema): Wave-1 additive columns — profile trio, agentProfile, voipConfig split (#259)"
```

---

### Task 2: Backfill script with built-in parity check

**Files:**
- Create: `scripts/backfill-wave1-columns.ts`

**Interfaces:**
- Consumes: Task 1 column names.
- Produces: an idempotent, `--dry-run`-capable backfill for all three tables, with a field-level parity diff (non-zero exit on ANY mismatch or Zod failure). This same script is re-run at prod cutover (rehearsal + live).

- [ ] **Step 1: Write the script**

Follow the pattern of `scripts/verify-final-tcp-parity.ts` (load-env, `main().catch`, per-row try/catch, counters). Complete script:

```ts
import './lib/load-env'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customers, leadSourcesTable, user } from '@/shared/db/schema'
import {
  customerProfileSchema,
  financialProfileSchema,
  propertyProfileSchema,
} from '@/shared/entities/customers/schemas'
import { voipConfigSchema } from '@/shared/entities/lead-sources/schemas'
import { agentProfileSchema } from '@/shared/entities/users/schemas'

/**
 * Wave 1 backfill: copy JSONB blob fields into their new columns.
 * Idempotent (plain deterministic UPDATEs). --dry-run reports without writing.
 * Parity: after each write, re-read the row and field-diff column vs blob.
 * ANY Zod failure or parity mismatch => non-zero exit. see spec §4.
 */
const DRY_RUN = process.argv.includes('--dry-run')

// blobField -> column property (identical names except mainPainPoint split)
const CUSTOMER_SCALARS = [
  'triggerEvent', 'outcomePriority', 'timeInHome', 'householdType',
  'priorContractorExperience', 'constructionOutlookFavorabilityRating',
  'sellPlan', 'decisionTimeline', 'projectNecessityRating', 'ageGroup', 'age',
  'additionalPainPoints',
] as const
const PROPERTY_SCALARS = [
  'hoa', 'yearBuilt', 'roofType', 'foundationType', 'hvacType',
  'hvacComponents', 'windowsType', 'insulationLevel',
] as const
const FINANCIAL_SCALARS = ['numQuotesReceived', 'creditScore'] as const

function isEqualJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

async function backfillCustomers(stats: Stats) {
  const rows = await db.select().from(customers)
  for (const row of rows) {
    try {
      const cp = row.customerProfileJSON
      const pp = row.propertyProfileJSON
      const fp = row.financialProfileJSON
      if (!cp && !pp && !fp) { stats.skipped++; continue }

      // Zod gate: a blob that no longer parses must be surfaced, not skipped
      if (cp) customerProfileSchema.parse(cp)
      if (pp) propertyProfileSchema.parse(pp)
      if (fp) financialProfileSchema.parse(fp)

      const patch: Record<string, unknown> = {}
      for (const k of CUSTOMER_SCALARS) patch[k] = cp?.[k as keyof typeof cp] ?? null
      patch.mainPainAccessor = cp?.mainPainPoint?.accessor ?? null
      patch.mainPainUrgency = cp?.mainPainPoint?.urgencyRating ?? null
      for (const k of PROPERTY_SCALARS) patch[k] = pp?.[k as keyof typeof pp] ?? null
      for (const k of FINANCIAL_SCALARS) patch[k] = fp?.[k as keyof typeof fp] ?? null

      if (DRY_RUN) { stats.wouldWrite++; continue }
      await db.update(customers).set(patch).where(eq(customers.id, row.id))

      // Parity: re-read and diff every mapped field
      const [after] = await db.select().from(customers).where(eq(customers.id, row.id))
      const diffs: string[] = []
      for (const k of CUSTOMER_SCALARS) {
        if (!isEqualJson(after[k as keyof typeof after], cp?.[k as keyof typeof cp] ?? null)) diffs.push(`customer.${k}`)
      }
      if (!isEqualJson(after.mainPainAccessor, cp?.mainPainPoint?.accessor ?? null)) diffs.push('mainPainAccessor')
      if (!isEqualJson(after.mainPainUrgency, cp?.mainPainPoint?.urgencyRating ?? null)) diffs.push('mainPainUrgency')
      for (const k of PROPERTY_SCALARS) {
        if (!isEqualJson(after[k as keyof typeof after], pp?.[k as keyof typeof pp] ?? null)) diffs.push(`property.${k}`)
      }
      for (const k of FINANCIAL_SCALARS) {
        if (!isEqualJson(after[k as keyof typeof after], fp?.[k as keyof typeof fp] ?? null)) diffs.push(`financial.${k}`)
      }
      if (diffs.length > 0) {
        stats.mismatches++
        console.error(`✗ customers ${row.id}: parity diff on ${diffs.join(', ')}`)
      }
      else { stats.written++ }
    }
    catch (err) {
      stats.errors++
      console.error(`✗ customers ${row.id}:`, err instanceof Error ? err.message : err)
    }
  }
}

async function backfillUsers(stats: Stats) {
  const rows = await db.select().from(user)
  for (const row of rows) {
    try {
      const ap = row.agentProfileJSON
      if (!ap) { stats.skipped++; continue }
      agentProfileSchema.parse(ap)
      const patch = {
        quote: ap.quote ?? null,
        bio: ap.bio ?? null,
        yearsOfExperience: ap.yearsOfExperience ?? null,
        tradeSpecialties: ap.tradeSpecialties ?? null,
        languagesSpoken: ap.languagesSpoken ?? null,
        certifications: ap.certifications ?? null,
        headshotUrl: ap.headshotUrl ?? null,
        headshotCropData: ap.headshotCropData ?? null,
      }
      if (DRY_RUN) { stats.wouldWrite++; continue }
      await db.update(user).set(patch).where(eq(user.id, row.id))
      const [after] = await db.select().from(user).where(eq(user.id, row.id))
      const diffs = (Object.keys(patch) as (keyof typeof patch)[])
        .filter(k => !isEqualJson(after[k], patch[k]))
      if (diffs.length > 0) {
        stats.mismatches++
        console.error(`✗ user ${row.id}: parity diff on ${diffs.join(', ')}`)
      }
      else { stats.written++ }
    }
    catch (err) {
      stats.errors++
      console.error(`✗ user ${row.id}:`, err instanceof Error ? err.message : err)
    }
  }
}

async function backfillLeadSources(stats: Stats) {
  const rows = await db.select().from(leadSourcesTable)
  for (const row of rows) {
    try {
      const vc = row.voipConfigJSON
      if (!vc) { stats.skipped++; continue }
      voipConfigSchema.parse(vc)
      const c = vc.campaigns
      const patch = {
        // absent blob sub-object == policy defaults; write them explicitly
        voipCampaignsEnabled: c?.enabled ?? true,
        voipAutoEnroll: c?.autoEnroll ?? false,
        defaultCampaignId: c?.defaultCampaignId ?? null,
        dailyDialVolumeCap: c?.dailyDialVolumeCap ?? null,
        messageTemplateOverridesJSON: c?.messageTemplateOverrides ?? null,
        voipInHouseConfigJSON: vc.inHouse ?? null,
      }
      if (DRY_RUN) { stats.wouldWrite++; continue }
      await db.update(leadSourcesTable).set(patch).where(eq(leadSourcesTable.id, row.id))
      const [after] = await db.select().from(leadSourcesTable).where(eq(leadSourcesTable.id, row.id))
      const diffs = (Object.keys(patch) as (keyof typeof patch)[])
        .filter(k => !isEqualJson(after[k], patch[k]))
      if (diffs.length > 0) {
        stats.mismatches++
        console.error(`✗ lead_sources ${row.slug}: parity diff on ${diffs.join(', ')}`)
      }
      else { stats.written++ }
    }
    catch (err) {
      stats.errors++
      console.error(`✗ lead_sources ${row.id}:`, err instanceof Error ? err.message : err)
    }
  }
}

interface Stats { written: number, wouldWrite: number, skipped: number, mismatches: number, errors: number }

async function main() {
  const tables = [
    ['customers', backfillCustomers],
    ['user', backfillUsers],
    ['lead_sources', backfillLeadSources],
  ] as const
  let failed = false
  for (const [label, fn] of tables) {
    const stats: Stats = { written: 0, wouldWrite: 0, skipped: 0, mismatches: 0, errors: 0 }
    await fn(stats)
    console.log(`${label}: written=${stats.written} wouldWrite=${stats.wouldWrite} skipped=${stats.skipped} mismatches=${stats.mismatches} errors=${stats.errors}${DRY_RUN ? ' (dry-run)' : ''}`)
    if (stats.mismatches > 0 || stats.errors > 0) failed = true
  }
  if (failed) {
    console.error('BACKFILL FAILED — non-zero mismatches/errors. No silent skips permitted (spec §4).')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

Note on `defaultCampaignId`: the FK now enforces referential integrity. If a blob holds a `defaultCampaignId` that no longer exists in `voip_campaigns`, the UPDATE throws FK violation → counted as an error → non-zero exit → human decides. That is the designed behavior, not a bug.

- [ ] **Step 2: Dry-run, then run against the worktree Neon branch**

```bash
pnpm tsx scripts/backfill-wave1-columns.ts --dry-run
pnpm tsx scripts/backfill-wave1-columns.ts
pnpm tsx scripts/backfill-wave1-columns.ts   # second run proves idempotency (same counts, 0 mismatches)
```
Expected: `mismatches=0 errors=0` on all three tables, both runs. Paste all three outputs in the task report.

- [ ] **Step 3: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add scripts/backfill-wave1-columns.ts
git commit -m "feat(scripts): Wave-1 parity-checked backfill — blobs → columns (#259)"
```

---

### Task 3: Customers cutover — readers, writers, CASL, deregistration

**Files:**
- Modify: `src/shared/db/schema/customers.ts` (TS-deprecate blobs; select/insert schema cleanup)
- Modify: `src/shared/entities/customers/lib/server-spec.ts` (deregister 3 of 4 merge columns)
- Modify: `src/shared/entities/customers/schemas/index.ts` (add `PROFILE_COLUMN_KEYS` + patch schema; `@deprecated` the three section schemas)
- Modify: `src/shared/domains/permissions/abilities.ts:93` (CASL field list)
- Modify: `src/trpc/routers/meeting-flow.router.ts` (flat patch input)
- Modify: `src/trpc/routers/proposals.router/contracts.router.ts:185-233` (age-patch = single column)
- Modify: `src/shared/entities/proposals/dal/server/queries.ts:96,129` (`customerAge` from column)
- Modify: `src/shared/entities/customers/hooks/use-customer-edit-form.ts` + `src/shared/entities/customers/lib/build-customer-form-defaults.ts`
- Modify: `src/features/meeting-flow/` readers: `lib/context-fill-count.ts`, `lib/profile-benefits.ts`, `lib/build-persona-profile.ts`, `ui/components/context-panel.tsx`, `ui/views/meeting-flow.tsx`, `constants/intake-steps.ts`
- Modify: `src/shared/entities/customers/components/profile/` (3 files) — read row columns
- Modify: `src/shared/entities/meetings/dal/server/queries.ts:103-105` (`MeetingCustomer` exposes columns)

**Interfaces:**
- Consumes: Task 1 columns; Task 2 backfilled data.
- Produces: `PROFILE_COLUMN_KEYS` (readonly tuple of the 24 column property names, grouped exports `CUSTOMER_PROFILE_COLUMN_KEYS`, `PROPERTY_PROFILE_COLUMN_KEYS`, `FINANCIAL_PROFILE_COLUMN_KEYS`) and `profileColumnsPatchSchema` in `src/shared/entities/customers/schemas/index.ts`. Task 6's docs reference the deregistration done here.

- [ ] **Step 1: Column-key constants + patch schema** (in `src/shared/entities/customers/schemas/index.ts`)

```ts
export const CUSTOMER_PROFILE_COLUMN_KEYS = [
  'triggerEvent', 'mainPainAccessor', 'mainPainUrgency', 'additionalPainPoints',
  'outcomePriority', 'timeInHome', 'householdType', 'priorContractorExperience',
  'constructionOutlookFavorabilityRating', 'sellPlan', 'decisionTimeline',
  'projectNecessityRating', 'ageGroup', 'age',
] as const
export const PROPERTY_PROFILE_COLUMN_KEYS = [
  'hoa', 'yearBuilt', 'roofType', 'foundationType', 'hvacType',
  'hvacComponents', 'windowsType', 'insulationLevel',
] as const
export const FINANCIAL_PROFILE_COLUMN_KEYS = ['numQuotesReceived', 'creditScore'] as const
export const PROFILE_COLUMN_KEYS = [
  ...CUSTOMER_PROFILE_COLUMN_KEYS,
  ...PROPERTY_PROFILE_COLUMN_KEYS,
  ...FINANCIAL_PROFILE_COLUMN_KEYS,
] as const
```

`profileColumnsPatchSchema`: `insertCustomerSchema.pick(...)` over `PROFILE_COLUMN_KEYS` then `.partial()`. If importing `insertCustomerSchema` here creates a cycle (schema file imports this file for `painSchema`), define the patch schema in `src/shared/db/schema/customers.ts` next to `insertCustomerSchema` and export from there instead — cycle-free by construction.

- [ ] **Step 2: TS-deprecate the blobs in the Drizzle table**

Rename properties (DB names UNCHANGED):
```ts
  /** @deprecated Wave-1 frozen (epic #256/#259). Zero writers. Read only by
   * scripts/backfill-wave1-columns.ts. Dropped next release. */
  customerProfileJSONDeprecated: jsonb('customer_profile_json').$type<CustomerProfile>(),
  propertyProfileJSONDeprecated: jsonb('property_profile_json').$type<PropertyProfile>(),
  financialProfileJSONDeprecated: jsonb('financial_profile_json').$type<FinancialProfile>(),
```
Remove the three profile overrides from `insertCustomerSchema` and `.omit()` the three deprecated keys so no caller can write them. Update `selectCustomerSchema` overrides accordingly (this also removes the pre-existing asymmetry where `customerProfileJSON` had no select override). Update the backfill script (Task 2 file) to the new property names.

- [ ] **Step 3: Deregister in `server-spec.ts:48-55`**

```ts
  update: {
    // leadMetaJSON only — profile trio decomposed to columns in Wave 1 (#259).
    // leadMetaJSON leaves in Wave 2 (customer_enrichment + source promotion).
    jsonbMergeColumns: [customers.leadMetaJSON] as const,
  },
```

- [ ] **Step 4: CASL** (`abilities.ts:93`)

```ts
      can('update', 'Customer', [...PROFILE_COLUMN_KEYS])
```
(import `PROFILE_COLUMN_KEYS`; spread because CASL wants `string[]`.)

- [ ] **Step 5: Writers — all three flows send flat column patches**

a) **meeting-flow router** — input becomes `{ meetingId, customerId, patch: profileColumnsPatchSchema }`; `data: input.patch`; Ably `fields: Object.keys(input.patch)`. The client (`meeting-flow.tsx:93-103` `handleCustomerProfileChange` + `context-panel.tsx:85/93/101`) stops merging `{ ...currentSection, ...patch }` — it sends ONLY the changed field(s): `mutate({ meetingId, customerId, patch: { [fieldId]: value } })`. `intake-steps.ts` drops every `jsonbKey:` line (the field accessor IS the column). Pain-point editors map to `mainPainAccessor`/`mainPainUrgency`/`additionalPainPoints`.

b) **edit form** (`use-customer-edit-form.ts:45-55`) — `handleSave` flattens its three sections into one flat object of the 24 keys and passes it as `data`. `build-customer-form-defaults.ts` seeds from row columns (`customer.age` etc.) instead of `?? {}` blob spreads. Semantics: field never touched → send nothing (undefined = column untouched); user cleared a field → send `null`.

c) **contracts age-patch** (`contracts.router.ts:228-232`) — the whole read-modify-spread collapses to:
```ts
      await customerCrud.update(SYSTEM_CONTEXT, {
        id: proposal.customer.id,
        data: { age: input.age },
      })
```
(delete the `existing.customerProfileJSON` read at :228 if now unused.)

- [ ] **Step 6: Readers — flip to columns**

Mapping is mechanical (`x.customerProfileJSON?.field` → `x.field`; `mainPainPoint.accessor` → `mainPainAccessor`; `mainPainPoint.urgencyRating` → `mainPainUrgency`):
- `context-fill-count.ts` — count over `customer[field.id]` directly from the row; total = `PROFILE_COLUMN_KEYS.length` framing stays consistent with the FIELDS constants.
- `profile-benefits.ts:19`, `build-persona-profile.ts` (incl. `:44-51`, `:341`), `context-panel.tsx:70-72`, `meeting-flow.tsx:97,244` (persona trigger: use a "any profile column filled" helper or `customer.triggerEvent != null` per current gating semantics — check what `:244` actually gates and preserve it).
- `proposals/dal/server/queries.ts` — select `customers.age`, `customerAge` maps directly.
- Profile display components (3 files) — build each card's record by picking the row keys via the three `*_COLUMN_KEYS` groups.
- `meetings/dal/server/queries.ts:103-105` — `MeetingCustomer` carries the flat columns (the `any`-typed blob fields go away).

- [ ] **Step 7: Verify + commit**

```bash
pnpm tsc && pnpm lint
grep -rn "customerProfileJSON\|propertyProfileJSON\|financialProfileJSON" src/ --include="*.ts" --include="*.tsx" | grep -v Deprecated | grep -v "DOCS.md"
```
Expected: tsc/lint clean; grep returns ONLY `scripts/`-side and deprecated-property definitions (plus doc files handled in Task 6).

```bash
git add -- src/shared/db/schema/customers.ts src/shared/entities/customers src/shared/domains/permissions/abilities.ts src/trpc/routers/meeting-flow.router.ts src/trpc/routers/proposals.router/contracts.router.ts src/shared/entities/proposals/dal/server/queries.ts src/features/meeting-flow src/shared/entities/meetings/dal/server/queries.ts scripts/backfill-wave1-columns.ts
git commit -m "feat(customers): profile trio cutover — blobs frozen, columns live everywhere (#259)"
```

---

### Task 4: agentProfile cutover — users DAL + router + clients

**Files:**
- Create: `src/shared/entities/users/dal/server/mutations.ts`
- Modify: `src/shared/db/schema/auth.ts` (TS-deprecate `agentProfileJSON`)
- Modify: `src/trpc/routers/agent-settings.router.ts` (delete raw `db.update`, route through DAL, flat input)
- Modify: `src/features/agent-settings/ui/components/customer-brand-section.tsx`, `headshot-upload.tsx`, `profile-header-card.tsx`
- Modify: `src/features/agent-settings/schemas/profile-form.ts`
- Modify: `scripts/snapshot-prod-to-dev.ts:105` (skipColumns)
- Modify: `src/shared/entities/users/schemas.ts` (`@deprecated` on `agentProfileSchema`; keep `cropDataSchema`)

**Interfaces:**
- Consumes: Task 1 user columns.
- Produces: `updateUserProfile(userId: string, patch: UpdateUserProfilePatch): Promise<DalReturn<User>>` in the new mutations file — the ONLY write path to `user`. Patch type = flat partial of `{ quote, bio, yearsOfExperience, tradeSpecialties, languagesSpoken, certifications, headshotUrl, headshotCropData, birthdate, funFact, phone, startDate }`.

- [ ] **Step 1: DAL mutation** (mirror the `dalDbOperation` pattern used in `src/shared/entities/lead-sources/dal/server/mutations.ts`)

```ts
export type UpdateUserProfilePatch = Partial<Pick<typeof user.$inferInsert,
  'quote' | 'bio' | 'yearsOfExperience' | 'tradeSpecialties' | 'languagesSpoken'
  | 'certifications' | 'headshotUrl' | 'headshotCropData'
  | 'birthdate' | 'funFact' | 'phone' | 'startDate'
>>

export async function updateUserProfile(
  userId: string,
  patch: UpdateUserProfilePatch,
): Promise<DalReturn<User>> {
  return dalDbOperation(async () => {
    const [updated] = await db
      .update(user)
      .set(patch)
      .where(eq(user.id, userId))
      .returning()
    return updated
  })
}
```
Drizzle skips `undefined` keys — a headshot save `{ headshotUrl }` can no longer clobber brand fields, and vice versa. **This single property kills the race**; no lock needed.

- [ ] **Step 2: Router** — `updateProfile` input becomes the flat patch schema (Zod: all fields `.nullish()`, arrays `z.array(z.string())`, `headshotCropData` = the existing crop shape); mutation body = `dalToTrpc(await updateUserProfile(ctx.session.user.id, input))`. Delete the raw `db.update` block (:34-44) and the `user`/`db` imports if now unused. `getProfile` unchanged (row now carries flat columns).

- [ ] **Step 3: Clients** — `customer-brand-section.tsx`: drop the `{ ...existingProfile, ...values }` spread; send form values flat; read fields off the row (`profile.quote` → `user.quote` etc.). `headshot-upload.tsx`: send `{ headshotUrl: publicUrl }` only; read `user.headshotUrl`. `profile-header-card.tsx:23`: `user.headshotUrl`. `profile-form.ts`: remove the `.omit({ headshotCropData })` indirection if the form schema now derives from the flat patch shape.

- [ ] **Step 4: TS-deprecate the blob** in `auth.ts` (same pattern as Task 3 Step 2): property → `agentProfileJSONDeprecated`, DB name `'agent_profile_json'` unchanged, JSDoc. Update `scripts/snapshot-prod-to-dev.ts:105` skipColumns entry to the new property name. Update the backfill script property reference.

- [ ] **Step 5: Verify + commit**

```bash
pnpm tsc && pnpm lint
grep -rn "agentProfileJSON" src/ scripts/ | grep -v Deprecated
```
Expected: clean; grep empty (except docs handled later).

```bash
git add -- src/shared/entities/users src/shared/db/schema/auth.ts src/trpc/routers/agent-settings.router.ts src/features/agent-settings scripts/snapshot-prod-to-dev.ts scripts/backfill-wave1-columns.ts
git commit -m "feat(users): agentProfile cutover — DAL-routed flat columns, race dead (#259)"
```

---

### Task 5: voipConfig cutover — plain column updates

**Files:**
- Modify: `src/shared/entities/lead-sources/dal/server/mutations.ts:28-64` (`setVoipCampaignsPolicy`)
- Modify: `src/trpc/routers/voip-campaigns.router.ts:68-74` (summaries read columns)
- Modify: `src/shared/services/customer-intake.service.ts:86-87`, `src/shared/services/voip/campaigns/enrollment.service.ts:93,104`
- Modify: `src/shared/db/schema/lead-sources.ts` (TS-deprecate `voipConfigJSON`)
- Modify: `src/shared/entities/lead-sources/DOCS.md:84-106`, `src/shared/entities/voip-campaigns/DOCS.md:27`
- Modify: `src/shared/entities/lead-sources/schemas.ts` (`@deprecated` on `voipConfigSchema`; keep the two sub-schemas — `voipInHousePolicySchema` types the new column)

**Interfaces:**
- Consumes: Task 1 lead_sources columns.
- Produces: `setVoipCampaignsPolicy(sourceSlug, patch)` same signature, new body — single UPDATE, no read-modify-write.

- [ ] **Step 1: Rewrite `setVoipCampaignsPolicy`** — the SELECT (:33-40), JS merge (:42-54) and blob write die:

```ts
export async function setVoipCampaignsPolicy(
  sourceSlug: string,
  patch: VoipCampaignsPolicyPatch,
): Promise<DalReturn<{ rowsAffected: number }>> {
  return dalDbOperation(async () => {
    const set: Partial<typeof leadSourcesTable.$inferInsert> = {}
    if (patch.enabled !== undefined) set.voipCampaignsEnabled = patch.enabled
    if (patch.autoEnroll !== undefined) set.voipAutoEnroll = patch.autoEnroll
    if (patch.defaultCampaignId !== undefined) set.defaultCampaignId = patch.defaultCampaignId
    if (Object.keys(set).length === 0) return { rowsAffected: 0 }

    const result = await db
      .update(leadSourcesTable)
      .set(set)
      .where(eq(leadSourcesTable.slug, sourceSlug))
      .returning({ id: leadSourcesTable.id })
    return { rowsAffected: result.length }
  })
}
```
`defaultCampaignId: null` clears the column (auto-enroll inert — semantics preserved). Concurrent toggles now touch disjoint columns atomically — the RMW race is structurally gone.

- [ ] **Step 2: Readers** — `voip-campaigns.router.ts:68-74`: `source.voipAutoEnroll`, `source.defaultCampaignId`, `source.voipCampaignsEnabled` (no more `?.campaigns?.` chains or `?? true/false` default-fills — column defaults carry it). Same flip in `customer-intake.service.ts:86-87` and `enrollment.service.ts:93,104`. Preserve exact gate semantics: enabled && autoEnroll && defaultCampaignId set.

- [ ] **Step 3: TS-deprecate** `voipConfigJSON` (property `voipConfigJSONDeprecated`, DB name unchanged); remove from `insertLeadSourceSchema`/select override per Task 3 Step 2 pattern; update backfill script property refs. Seed scripts (`seed-lead-sources.ts:124`, `seed-bina-lead-source.ts:23`) write columns instead.

- [ ] **Step 4: DOCS** — update the two DOCS.md sections to state: policy is still source-owned, now as COLUMNS (`voip_campaigns_enabled`, `voip_auto_enroll`, `default_campaign_id` real FK → `voip_campaigns.id` `onDelete: 'set null'`, `daily_dial_volume_cap`, `message_template_overrides_json`); `voip_inhouse_config_json` is the in-house EPIC's column; "unset defaultCampaignId ⇒ auto-enroll inert" rule unchanged. Keep anchors/slugs intact.

- [ ] **Step 5: Verify + commit**

```bash
pnpm tsc && pnpm lint
grep -rn "voipConfigJSON" src/ scripts/ | grep -v Deprecated
git add -- src/shared/entities/lead-sources src/shared/entities/voip-campaigns/DOCS.md src/shared/db/schema/lead-sources.ts src/trpc/routers/voip-campaigns.router.ts src/shared/services/customer-intake.service.ts src/shared/services/voip/campaigns/enrollment.service.ts scripts/backfill-wave1-columns.ts scripts/seed-lead-sources.ts scripts/seed-bina-lead-source.ts
git commit -m "feat(lead-sources): voipConfig split — policy columns + real FK, RMW race dead (#259)"
```

---

### Task 6: Proposals deregistration + stale-docs truth pass

**Files:**
- Modify: `src/shared/entities/proposals/lib/server-spec.ts:37-44` (delete `update:` block)
- Modify: `src/shared/entities/proposals/DOCS.md:98-105` (rewrite section)
- Modify: `docs/codebase-conventions/jsonb-columns.md:81-96` (truth-correct the body, KEEP the `### never-shallow-merge-nested` heading — inbound anchors)
- Modify: `docs/codebase-conventions/dal-conventions.md:126` (See-also line)
- Modify: `src/shared/entities/customers/schemas/index.ts:141-144` (leadMeta comment)

**Interfaces:** consumes Task 3's deregistration state (customers = leadMetaJSON only).

- [ ] **Step 1: Delete `update:` block** at `server-spec.ts:37-44`. Proposal updates now take the plain whole-value path (`create-crud-dal.ts:120-123`) — verified correct because every writer sends whole documents (edit-proposal-view, funding.tsx, contracts.router; ai/client.ts already bypassed the CRUD). Field-clearing becomes possible again.

- [ ] **Step 2: Rewrite `proposals/DOCS.md` `### jsonb-merge-on-update`** (keep the heading slug; replace body):

```markdown
### jsonb-merge-on-update

**Retired (Wave 1, epic #256).** `formMetaJSON`, `projectJSON`, `fundingJSON` are
whole-document columns: every writer reconstructs and submits the full blob, so
updates REPLACE the column (plain CRUD path). They were previously registered in
`spec.update.jsonbMergeColumns`, which shallow-merged top-level keys and silently
prevented field-clearing — deregistered because no caller ever sent a partial.
Do not re-register: a whole-document writer + `||` merge resurrects deleted keys.
Full decomposition of these blobs lands in Waves 2–3
(see docs/superpowers/specs/2026-07-09-jsonb-decomposition-program-design.md §2).
```
Also fix the pointer comment at `server-spec.ts:38` (it references this section — the deletion in Step 1 removes it; confirm nothing else in the file points here).

- [ ] **Step 3: Truth-correct `jsonb-columns.md#never-shallow-merge-nested`** — the body currently claims the house pattern is "app-side recursive deep-merge under a row lock + Zod re-parse of the merged whole". The shipped code (`create-crud-dal.ts:146-148`) is a single-statement `COALESCE(col,'{}'::jsonb) || value::jsonb` — a TOP-LEVEL-ONLY merge, no lock, no re-parse. Rewrite the body to state: (1) Postgres `||` is shallow — never let a partial nested object through it; (2) the CRUD `jsonbMergeColumns` mechanism merges top-level keys only and is safe ONLY while callers send complete values for any nested key they touch; (3) sole remaining registration is `customers.leadMetaJSON` (until Wave 2 deletes the mechanism per the program spec); (4) for nested key-level patches use a scoped `jsonb_set` at the exact path (reference impl: `mergeFunnelEnrichment`, `customers/dal/server/mutations.ts:57`). Heading text `### never-shallow-merge-nested` MUST remain byte-identical.

- [ ] **Step 4: `dal-conventions.md:126`** — replace the See-also line with:

```markdown
- `docs/codebase-conventions/jsonb-columns.md#never-shallow-merge-nested` — JSONB merge safety (top-level-only `||` via `spec.update.jsonbMergeColumns`; sole remaining registration `customers.leadMetaJSON`, mechanism deleted in Wave 2 of epic #256)
```

- [ ] **Step 5: Fix the leadMeta comment** at `customers/schemas/index.ts:141-144`:

```ts
      // Written via mergeFunnelEnrichment (scoped `jsonb_set` at {source,enrichment} —
      // atomic, hook-free). NOTE: leadMetaJSON is ALSO registered in jsonbMergeColumns,
      // so generic crud.update applies a TOP-LEVEL-ONLY `||` merge: sending a partial
      // `source` object through crud.update WOULD clobber sibling keys incl. this map.
      // No caller does that today; Wave 2 (epic #256) decomposes this blob and deletes
      // the merge mechanism. Shape: see enrichmentRecordSchema above.
```

- [ ] **Step 6: Verify + commit**

```bash
pnpm tsc && pnpm lint
grep -rn "never-shallow-merge-nested" docs/ src/ | grep -v "jsonb-columns.md:81"   # inbound anchors intact
git add -- src/shared/entities/proposals/lib/server-spec.ts src/shared/entities/proposals/DOCS.md docs/codebase-conventions/jsonb-columns.md docs/codebase-conventions/dal-conventions.md src/shared/entities/customers/schemas/index.ts
git commit -m "fix(docs+proposals): deregister proposals merge columns; truth-correct jsonb docs (#259)"
```

---

### Task 7: Cutover runbook (docs only — executed by human at merge)

**Files:**
- Create: `docs/superpowers/plans/2026-07-13-wave-1-cutover-runbook.md`

- [ ] **Step 1: Write the runbook** containing, in order:

```markdown
# Wave 1 Cutover Runbook (human-executed, per spec §4)

Pre-flight (local main, after PR merge, BEFORE deploy):
1. `node --env-file=.env .superpowers/sdd/snapshot-notion-ids.mjs` — fresh
   pre-drop export of customers.notion_contact_id (Wave-1 prod push drops it —
   Notion retirement rider, commit 14dbd44b).
2. Rehearsal: create a Neon branch off PRODUCTION (`mcp Neon create_branch`
   or console), point DATABASE_URL_OVERRIDE at it, then:
   a. `pnpm drizzle-kit push` against the REHEARSAL branch only
      (verify the plan: adds 16 enums + 38 columns, DROPS notion_contact_id
      + its unique constraint, NOTHING else)
   b. `pnpm tsx scripts/backfill-wave1-columns.ts --dry-run` then live run
      then re-run (idempotency) — require mismatches=0 errors=0 all runs
   c. Delete the rehearsal branch (ASK FIRST — never autonomous)
3. Prod cutover (only after clean rehearsal): `pnpm db:push` (THE deliberate
   prod push), then `pnpm tsx scripts/backfill-wave1-columns.ts` with
   NODE_ENV=production wiring per memory/feedback-runtime-db-env, then deploy.
   Order matters: push+backfill BEFORE the deploy that flips reads/writes —
   old code ignores new columns; new code must never see empty columns.
4. Post-deploy: re-run backfill once more (catches writes that raced the
   deploy window — blob writers existed until this deploy), require
   mismatches=0. Then drive: funnel intake, meeting-flow profile edit,
   customer edit form, agent settings (brand + headshot), campaigns admin
   source-policy card.
5. Next release: drop the three frozen blob columns + agent_profile_json +
   voip_config_json from schema (their own mini-push).
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-07-13-wave-1-cutover-runbook.md
git commit -m "docs: Wave-1 cutover runbook — rehearsal protocol + notion_contact_id rider (#259)"
```
