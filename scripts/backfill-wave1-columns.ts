import process from 'node:process'
import { eq } from 'drizzle-orm'
import { customerProfiles, customers, leadSourcesTable, user } from '@/shared/db/schema'
import {
  customerProfileSchema,
  financialProfileSchema,
  propertyProfileSchema,
} from '@/shared/entities/customers/schemas'
import { voipConfigSchema } from '@/shared/entities/lead-sources/schemas'
import { agentProfileSchema } from '@/shared/entities/users/schemas'
import { createScriptDb } from './lib/script-db'

// Explicit-target client (default: dev/worktree; `--target=prod` for cutover).
// Deliberately NOT the app's `@/shared/db` singleton — see script-db.ts.
const db = createScriptDb()

/**
 * Wave 1 backfill: copy JSONB blob fields into their new columns.
 * Idempotent (plain deterministic UPDATEs). --dry-run reports without writing.
 * Parity: after each write, re-read the row and field-diff column vs blob.
 * ANY Zod failure or parity mismatch => non-zero exit. see spec §4.
 */
const DRY_RUN = process.argv.includes('--dry-run')

// Legacy enum labels found in prod (2026-07-13 audit, 7 rows). Mapped or
// dropped EXPLICITLY — spec §4 forbids silently skipping rows. Mapping
// decisions recorded in the Wave-1 PR for review:
//  - creditScore range-subsets and the triggerEvent rename are lossless
//  - ageGroup midpoints are approximations (40-62 → '45-65', 62-78 → '65-75')
//  - old householdType labels describe life-stage, not composition → dropped (null + log)
const LEGACY_ENUM_MAP: Record<string, Record<string, string | null>> = {
  householdType: { 'Senior(s)': null, 'Empty nester(s)': null },
  ageGroup: { 'Adult (40-62)': '45-65', 'Senior (62-78)': '65-75' },
  triggerEvent: { 'Scheduled maintenance': 'Maintenance' },
  creditScore: { '650–700': '600 – 700', '750–800': '700+' },
}

// Dead pre-Zod blob KEYS (2026-07-14 rehearsal eyeball audit; ruling recorded
// in PR #260). Whole keys no current schema knows, distinct from the enum-LABEL
// map above:
//  - decisionUrgencyRating → decisionTimeline (salvaged — old key name for the
//    same concept; sub-month urgency values collapse to 'ASAP')
//  - familyStatus → dropped (no target concept in customer_profiles; data stays
//    recoverable in the frozen blob until the next-release blob drop)
const LEGACY_URGENCY_TO_TIMELINE: Record<string, string> = { 'ASAP': 'ASAP', '1–2 weeks': 'ASAP' }

function normalizeLegacyKeys(
  blob: Record<string, unknown> | null | undefined,
  rowId: string,
): Record<string, unknown> | null {
  if (!blob)
    return null
  const normalized = { ...blob }
  if ('decisionUrgencyRating' in normalized) {
    const raw = String(normalized.decisionUrgencyRating)
    delete normalized.decisionUrgencyRating
    const mapped = LEGACY_URGENCY_TO_TIMELINE[raw]
    if (mapped == null) {
      console.warn(`↷ customers ${rowId}: decisionUrgencyRating "${raw}" → DROPPED (unmappable)`)
    }
    else if (normalized.decisionTimeline != null) {
      console.warn(`↷ customers ${rowId}: decisionUrgencyRating "${raw}" → DROPPED (decisionTimeline already set)`)
    }
    else {
      normalized.decisionTimeline = mapped
      console.warn(`↷ customers ${rowId}: decisionUrgencyRating "${raw}" → decisionTimeline "${mapped}"`)
    }
  }
  if ('familyStatus' in normalized) {
    console.warn(`↷ customers ${rowId}: familyStatus "${String(normalized.familyStatus)}" → DROPPED (dead legacy key)`)
    delete normalized.familyStatus
  }
  return normalized
}

// blobField -> customer_profiles column property (identical names except
// mainPainPoint split). `age` is handled separately — it stays a plain
// column on `customers`, not part of the 23-field child-table patch.
const CUSTOMER_SCALARS = [
  'triggerEvent',
  'outcomePriority',
  'timeInHome',
  'householdType',
  'priorContractorExperience',
  'constructionOutlookFavorabilityRating',
  'sellPlan',
  'decisionTimeline',
  'projectNecessityRating',
  'ageGroup',
  'additionalPainPoints',
] as const
const PROPERTY_SCALARS = [
  'hoa',
  'yearBuilt',
  'roofType',
  'foundationType',
  'hvacType',
  'hvacComponents',
  'windowsType',
  'insulationLevel',
] as const
const FINANCIAL_SCALARS = ['numQuotesReceived', 'creditScore'] as const

function isEqualJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

function normalizeLegacyEnums(
  blob: Record<string, unknown> | null | undefined,
  fields: string[],
  rowId: string,
  tableLabel: string,
): Record<string, unknown> | null {
  if (!blob)
    return null
  const normalized = { ...blob }
  for (const field of fields) {
    const value = normalized[field]
    if (value == null)
      continue
    const fieldMap = LEGACY_ENUM_MAP[field]
    if (!fieldMap)
      continue
    const stringValue = String(value)
    if (stringValue in fieldMap) {
      const mappedValue = fieldMap[stringValue]
      if (mappedValue === null) {
        delete normalized[field]
        console.warn(`↷ ${tableLabel} ${rowId}: ${field} "${stringValue}" → DROPPED (unmappable)`)
      }
      else {
        normalized[field] = mappedValue
        console.warn(`↷ ${tableLabel} ${rowId}: ${field} "${stringValue}" → "${mappedValue}"`)
      }
    }
  }
  return normalized
}

async function backfillCustomers(stats: Stats) {
  const rows = await db.select().from(customers)
  const childStats = { written: 0, skipped: 0, wouldWrite: 0 }
  for (const row of rows) {
    try {
      let cp = row.customerProfileJSONDeprecated
      const pp = row.propertyProfileJSONDeprecated
      let fp = row.financialProfileJSONDeprecated
      if (!cp && !pp && !fp) {
        stats.skipped++
        continue
      }

      // Normalize legacy KEYS then legacy enum labels BEFORE Zod parse
      cp = normalizeLegacyKeys(cp, row.id) as any
      cp = normalizeLegacyEnums(cp, ['householdType', 'ageGroup', 'triggerEvent'], row.id, 'customers') as any
      fp = normalizeLegacyEnums(fp, ['creditScore'], row.id, 'customers') as any

      // Zod gate: a blob that no longer parses must be surfaced, not skipped
      if (cp)
        customerProfileSchema.parse(cp)
      if (pp)
        propertyProfileSchema.parse(pp)
      if (fp)
        financialProfileSchema.parse(fp)

      // `age` stays a plain column on customers (Addendum B.2) — unchanged
      // mechanism, independent of whether the child row gets written.
      const agePatch = { age: cp?.age ?? null }

      // The 23 moved fields land on customer_profiles (1:1 child, PK-as-FK).
      const patch23: Record<string, unknown> = {}
      for (const k of CUSTOMER_SCALARS) patch23[k] = cp?.[k as keyof typeof cp] ?? null
      patch23.mainPainAccessor = cp?.mainPainPoint?.accessor ?? null
      patch23.mainPainUrgency = cp?.mainPainPoint?.urgencyRating ?? null
      for (const k of PROPERTY_SCALARS) patch23[k] = pp?.[k as keyof typeof pp] ?? null
      for (const k of FINANCIAL_SCALARS) patch23[k] = fp?.[k as keyof typeof fp] ?? null

      // Row-exists semantics (see customer-profiles.ts): a child row is only
      // written when discovery data actually landed in one of the 23 moved
      // fields. A blob containing ONLY `age` writes customers.age and leaves
      // NO all-null child row behind.
      const hasChildData = Object.values(patch23).some(v => v !== null)

      if (DRY_RUN) {
        stats.wouldWrite++
        if (hasChildData)
          childStats.wouldWrite++
        else
          childStats.skipped++
        continue
      }

      await db.update(customers).set(agePatch).where(eq(customers.id, row.id))
      if (hasChildData) {
        await db.insert(customerProfiles)
          .values({ customerId: row.id, ...patch23 } as any)
          .onConflictDoUpdate({ target: customerProfiles.customerId, set: patch23 as any })
        childStats.written++
      }
      else {
        childStats.skipped++
      }

      // Parity: re-read and diff every mapped field — customers.age always,
      // the child row only when we expected one (else assert its absence).
      const diffs: string[] = []
      const [afterCustomer] = await db.select({ age: customers.age }).from(customers).where(eq(customers.id, row.id))
      if (!isEqualJson(afterCustomer?.age, cp?.age ?? null))
        diffs.push('customer.age')

      const [afterProfile] = await db.select().from(customerProfiles).where(eq(customerProfiles.customerId, row.id))
      if (hasChildData) {
        if (!afterProfile) {
          diffs.push('customer_profiles: expected row, found none')
        }
        else {
          for (const [k, v] of Object.entries(patch23)) {
            if (!isEqualJson(afterProfile[k as keyof typeof afterProfile], v))
              diffs.push(`profile.${k}`)
          }
        }
      }
      else if (afterProfile) {
        diffs.push('customer_profiles: unexpected row (all 23 fields null)')
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
  console.log(`customers → customer_profiles: written=${childStats.written} skipped=${childStats.skipped} wouldWrite=${childStats.wouldWrite}${DRY_RUN ? ' (dry-run)' : ''}`)
}

async function backfillUsers(stats: Stats) {
  const rows = await db.select().from(user)
  for (const row of rows) {
    try {
      const ap = row.agentProfileJSONDeprecated
      if (!ap) {
        stats.skipped++
        continue
      }
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
      if (DRY_RUN) {
        stats.wouldWrite++
        continue
      }
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
      const vc = row.voipConfigJSONDeprecated
      if (!vc) {
        stats.skipped++
        continue
      }
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
      if (DRY_RUN) {
        stats.wouldWrite++
        continue
      }
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
    if (stats.mismatches > 0 || stats.errors > 0)
      failed = true
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
