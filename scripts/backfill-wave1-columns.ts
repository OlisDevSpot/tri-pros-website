import process from 'node:process'
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
import './lib/load-env'

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

// blobField -> column property (identical names except mainPainPoint split)
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
  'age',
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
  for (const row of rows) {
    try {
      let cp = row.customerProfileJSONDeprecated
      const pp = row.propertyProfileJSONDeprecated
      let fp = row.financialProfileJSONDeprecated
      if (!cp && !pp && !fp) {
        stats.skipped++
        continue
      }

      // Normalize legacy enum labels BEFORE Zod parse
      cp = normalizeLegacyEnums(cp, ['householdType', 'ageGroup', 'triggerEvent'], row.id, 'customers') as any
      fp = normalizeLegacyEnums(fp, ['creditScore'], row.id, 'customers') as any

      // Zod gate: a blob that no longer parses must be surfaced, not skipped
      if (cp)
        customerProfileSchema.parse(cp)
      if (pp)
        propertyProfileSchema.parse(pp)
      if (fp)
        financialProfileSchema.parse(fp)

      const patch: Record<string, unknown> = {}
      for (const k of CUSTOMER_SCALARS) patch[k] = cp?.[k as keyof typeof cp] ?? null
      patch.mainPainAccessor = cp?.mainPainPoint?.accessor ?? null
      patch.mainPainUrgency = cp?.mainPainPoint?.urgencyRating ?? null
      for (const k of PROPERTY_SCALARS) patch[k] = pp?.[k as keyof typeof pp] ?? null
      for (const k of FINANCIAL_SCALARS) patch[k] = fp?.[k as keyof typeof fp] ?? null

      if (DRY_RUN) {
        stats.wouldWrite++
        continue
      }
      await db.update(customers).set(patch).where(eq(customers.id, row.id))

      // Parity: re-read and diff every mapped field
      const [after] = await db.select().from(customers).where(eq(customers.id, row.id))
      const diffs: string[] = []
      for (const k of CUSTOMER_SCALARS) {
        if (!isEqualJson(after[k as keyof typeof after], cp?.[k as keyof typeof cp] ?? null))
          diffs.push(`customer.${k}`)
      }
      if (!isEqualJson(after.mainPainAccessor, cp?.mainPainPoint?.accessor ?? null))
        diffs.push('mainPainAccessor')
      if (!isEqualJson(after.mainPainUrgency, cp?.mainPainPoint?.urgencyRating ?? null))
        diffs.push('mainPainUrgency')
      for (const k of PROPERTY_SCALARS) {
        if (!isEqualJson(after[k as keyof typeof after], pp?.[k as keyof typeof pp] ?? null))
          diffs.push(`property.${k}`)
      }
      for (const k of FINANCIAL_SCALARS) {
        if (!isEqualJson(after[k as keyof typeof after], fp?.[k as keyof typeof fp] ?? null))
          diffs.push(`financial.${k}`)
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
