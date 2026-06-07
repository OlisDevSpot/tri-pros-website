/* eslint-disable no-console */
/**
 * One-shot bulk seeder: bring `customers` up to date from a Bina contacts CSV,
 * the same way a Bina webhook would — but in bulk, idempotently, with ZERO data
 * loss. Backfills `leadMetaJSON` (trade + kitchen/bathroom detail) onto existing
 * Bina leads and inserts any genuinely-new ones.
 *
 * Mirrors the prod-safe pattern of scripts/backfill-interested-trades-raw.ts and
 * reuses the REAL webhook normalizer (normalizeBinaLead) so the field mapping
 * cannot drift from the live ingest path.
 *
 * SAFETY (see docs/superpowers/specs/2026-06-07-bina-contacts-csv-seeder-design.md):
 *   - DRY-RUN BY DEFAULT. Writes happen ONLY with --commit.
 *   - Never DELETE, never overwrite a non-null value, never set updatedAt on update.
 *   - Match by phone (last-10 digits). 1 match → fill-gaps update; 0 → insert (if
 *     name+city+zip present, else skip+report); >1 → skip+report (ambiguous).
 *   - Idempotent: a second run no-ops.
 *
 * Target DB is chosen by NODE_ENV (runtime db client reads DATABASE_URL vs
 * DATABASE_DEV_URL by NODE_ENV — see memory/feedback-runtime-db-env):
 *   dev :  pnpm seed:bina-contacts:dev -- --file=<path>
 *   prod:  pnpm seed:bina-contacts     -- --file=<path>            (NODE_ENV=production)
 *
 * Flags:
 *   --file=<path>   REQUIRED. Path to the Bina contacts CSV.
 *   --commit        Actually write. Without it, dry-run (report only, no writes).
 */
import './lib/load-env'

import type { BinaContactPayload } from '@/shared/services/providers/gohighlevel/types'
import type { LeadMeta } from '@/shared/entities/customers/schemas'

import { readFileSync } from 'node:fs'
import { eq } from 'drizzle-orm'

import { db } from '@/shared/db'
import { customerNotes } from '@/shared/db/schema/customer-notes'
import { customers } from '@/shared/db/schema/customers'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'
import { leadMetaSchema } from '@/shared/entities/customers/schemas'
import { normalizeBinaLead } from '@/shared/services/providers/gohighlevel/lib/normalize-bina-lead'

const COMMIT = process.argv.includes('--commit')
const fileArg = process.argv.find(a => a.startsWith('--file='))?.slice('--file='.length)

/** Strip BOM + repair the CP1252-as-UTF8 mojibake the export contains. */
function sanitize(text: string): string {
  return text
    .replace(/^﻿/, '')
    .replaceAll('â€“', '-')
    .replaceAll('â€”', '-')
    .replaceAll('â€™', '\'')
}

/** Quote-aware RFC4180-ish CSV → array of records (no dependency available). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let record: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        }
        else {
          inQuotes = false
        }
      }
      else {
        field += c
      }
      continue
    }
    if (c === '"') {
      inQuotes = true
    }
    else if (c === ',') {
      record.push(field)
      field = ''
    }
    else if (c === '\r') {
      // ignore — handled by the \n branch
    }
    else if (c === '\n') {
      record.push(field)
      rows.push(record)
      record = []
      field = ''
    }
    else {
      field += c
    }
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field)
    rows.push(record)
  }
  return rows
}

/** CSV → array of {header: value} objects, trimming outer whitespace + dropping blank rows. */
function toRecords(text: string): Record<string, string>[] {
  const grid = parseCsv(sanitize(text))
  if (grid.length === 0) {
    return []
  }
  const keys = grid[0].map(h => h.trim())
  return grid
    .slice(1)
    .filter(cols => cols.some(c => c.trim() !== ''))
    .map(cols => Object.fromEntries(keys.map((k, idx) => [k, (cols[idx] ?? '').trim()])))
}

/** Last 10 digits — robust to "+1XXXXXXXXXX" vs "1XXXXXXXXXX" vs "XXXXXXXXXX". */
function phoneKey(phone: string | null): string {
  return (phone ?? '').replace(/\D/g, '').slice(-10)
}

/** "6/7/2026" + "10:00 AM - 12:00 PM" → "2026-06-07T10:00:00-07:00" (start of window, PDT). */
function toIsoStart(dateStr: string, timeStr: string): string | undefined {
  if (!dateStr || !timeStr) {
    return undefined
  }
  const dm = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!dm) {
    return undefined
  }
  const startPart = timeStr.split(/\s*[-–]\s*/)[0]?.trim() ?? ''
  const tm = startPart.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!tm) {
    return undefined
  }
  const [, mo, d, y] = dm
  let hour = Number(tm[1])
  const minute = tm[2]
  const ap = tm[3].toUpperCase()
  if (ap === 'PM' && hour !== 12) {
    hour += 12
  }
  if (ap === 'AM' && hour === 12) {
    hour = 0
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${y}-${pad(Number(mo))}-${pad(Number(d))}T${pad(hour)}:${minute}:00-07:00`
}

/** Build a webhook-shaped Bina payload from a CSV row (empty strings → ghlString null downstream). */
function buildPayload(row: Record<string, string>): BinaContactPayload {
  const isoStart = toIsoStart(row['Appointment Date'] ?? '', row['Appointment Time'] ?? '')
  return {
    firstName: row['First Name'] ?? '',
    lastName: row['Last Name'] ?? '',
    email: '',
    phone: row.Phone ?? '',
    address: row['Street Address'] || undefined,
    city: row.City ?? '',
    zip: row['Postal Code'] ?? '',
    additionalData: {
      // CORRECTED mapping: Product is the trade list (Type of Job is empty/category for most rows).
      trades: row.Product || undefined,
      selfBookingDateTime: isoStart,
      kitchenSize: row['Kitchen Size'] || undefined,
      kitchenScope: row['Kitchen Renovation Scope'] || undefined,
      kitchenAge: row['Kitchen Age'] || undefined,
      bathroomSize: row['Bathroom Size'] || undefined,
      bathroomScope: row['Bathroom Renovation Scope'] || undefined,
      bathroomAge: row['Bathroom Age'] || undefined,
    },
  }
}

async function main() {
  const target = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'dev'

  if (!fileArg) {
    console.error('[seed:bina] missing required --file=<path>')
    process.exit(1)
  }

  console.log(`[seed:bina] target=${target} mode=${COMMIT ? 'COMMIT (WRITING)' : 'DRY RUN (no writes)'} file=${fileArg}`)
  if (COMMIT && target === 'PRODUCTION') {
    console.log('[seed:bina] ⚠️  writing to PRODUCTION')
  }

  const [bina] = await db
    .select({ id: leadSourcesTable.id })
    .from(leadSourcesTable)
    .where(eq(leadSourcesTable.slug, 'bina'))
    .limit(1)
  if (!bina) {
    console.error('[seed:bina] no lead source with slug "bina" — aborting')
    process.exit(1)
  }

  // Load every customer once; index by normalized phone.
  const existing = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
      address: customers.address,
      leadMetaJSON: customers.leadMetaJSON,
    })
    .from(customers)
  const byPhone = new Map<string, typeof existing>()
  for (const c of existing) {
    const k = phoneKey(c.phone)
    if (k.length < 10) {
      continue
    }
    const arr = byPhone.get(k) ?? []
    arr.push(c)
    byPhone.set(k, arr)
  }
  console.log(`[seed:bina] loaded ${existing.length} customers (${byPhone.size} distinct phones)`)

  const records = toRecords(readFileSync(fileArg, 'utf8'))
  console.log(`[seed:bina] parsed ${records.length} CSV rows`)

  let matched = 0
  let updated = 0
  let noop = 0
  let inserted = 0
  let skippedIncomplete = 0
  let skippedAmbiguous = 0
  let parseErrors = 0

  for (const row of records) {
    const payload = buildPayload(row)
    const { core, leadMeta: rawMeta, note } = normalizeBinaLead(payload)

    let leadMeta: LeadMeta
    try {
      leadMeta = leadMetaSchema.parse(rawMeta)
    }
    catch (err) {
      parseErrors++
      console.warn(`  skip:parse ${core.name || '(no name)'} ${payload.phone} — ${(err as Error).message}`)
      continue
    }

    const key = phoneKey(payload.phone)
    const tail = key || '(no phone)'
    const matches = key.length === 10 ? (byPhone.get(key) ?? []) : []

    if (matches.length > 1) {
      skippedAmbiguous++
      console.warn(`  skip:ambiguous ${core.name} ${tail} — ${matches.length} customers share this phone`)
      continue
    }

    if (matches.length === 1) {
      matched++
      const c = matches[0]
      const patch: { address?: string, email?: string, leadMetaJSON?: LeadMeta } = {}
      if (c.leadMetaJSON == null) {
        patch.leadMetaJSON = leadMeta
      }
      if (!c.address && core.address) {
        patch.address = core.address
      }
      if (!c.email && core.email) {
        patch.email = core.email
      }
      const fields = Object.keys(patch)
      if (fields.length === 0) {
        noop++
        console.log(`  noop ${core.name} ${tail}`)
        continue
      }
      console.log(`  ${COMMIT ? 'updated' : 'would-update'} ${core.name} ${tail} → ${fields.join(', ')}`)
      if (COMMIT) {
        // updatedAt auto-bumps via schema-helper $onUpdate — never set it.
        await db.update(customers).set(patch).where(eq(customers.id, c.id))
      }
      updated++
      continue
    }

    // No match → insert, but only with the NOT NULL fields present.
    if (!core.name || !core.city || !core.zip) {
      skippedIncomplete++
      const missing = [!core.name && 'name', !core.city && 'city', !core.zip && 'zip'].filter(Boolean).join('/')
      console.warn(`  skip:incomplete ${core.name || '(no name)'} ${tail} — missing ${missing}`)
      continue
    }

    const createdAt = row.Created || undefined
    console.log(`  ${COMMIT ? 'inserted' : 'would-insert'} ${core.name} ${tail}`)
    if (COMMIT) {
      const [createdRow] = await db
        .insert(customers)
        .values({
          name: core.name,
          phone: core.phone,
          email: core.email,
          address: core.address,
          city: core.city,
          state: 'CA',
          zip: core.zip,
          leadSourceId: bina.id,
          leadMetaJSON: leadMeta,
          pipeline: 'active',
          ...(createdAt ? { createdAt } : {}),
        })
        .returning({ id: customers.id })
      if (note && createdRow) {
        await db.insert(customerNotes).values({ customerId: createdRow.id, content: note, authorId: null })
      }
    }
    inserted++
  }

  console.log('[seed:bina] summary', {
    scanned: records.length,
    matched,
    [COMMIT ? 'updated' : 'wouldUpdate']: updated,
    noop,
    [COMMIT ? 'inserted' : 'wouldInsert']: inserted,
    skippedIncomplete,
    skippedAmbiguous,
    parseErrors,
  })
  process.exit(0)
}

main().catch((err) => {
  console.error('[seed:bina] failed', err)
  process.exit(1)
})
