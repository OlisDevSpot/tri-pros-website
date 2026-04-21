/* eslint-disable dot-notation */
/**
 * One-time migration: Notion Contacts + Meetings → Postgres
 *
 * Run: pnpm tsx scripts/migrate-notion-contacts.ts
 *
 * Phase 1 — Contacts: Inserts new customers, skips existing (PG is source of truth).
 * Phase 2 — Meetings: Creates meetings linked to customers.
 *           New meetings get trades populated in flowStateJSON.
 *           Existing meetings get trades backfilled if flowStateJSON is empty.
 *
 * Notion access: READ-ONLY. No Notion rows are modified.
 * MP3s: Downloaded from Notion signed URLs and re-uploaded to R2.
 *        Per-contact failure is logged and skipped, never aborts the run.
 */
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { LeadMeta } from '../src/shared/entities/customers/schemas'
import type { MeetingFlowState, TradeSelection } from '../src/shared/entities/meetings/schemas'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import env from '../src/shared/config/server-env'
import * as schema from '../src/shared/db/schema'
import { user } from '../src/shared/db/schema/auth'
import { customerNotes } from '../src/shared/db/schema/customer-notes'
import { customers } from '../src/shared/db/schema/customers'
import { leadSourcesTable } from '../src/shared/db/schema/lead-sources'
import { meetings } from '../src/shared/db/schema/meetings'
import { notionClient } from '../src/shared/services/notion/client'
import { notionDatabasesMeta } from '../src/shared/services/notion/constants/databases'
import { pageToContact } from '../src/shared/services/notion/lib/contacts/adapter'
import { titleText } from '../src/shared/services/notion/lib/extractors'
import { R2_BUCKETS } from '../src/shared/services/r2/buckets'
import { putObject } from '../src/shared/services/r2/put-object'

// ── Constants ──────────────────────────────────────────────

const dbUrl = process.env.DRIZZLE_TARGET === 'dev' ? env.DATABASE_DEV_URL! : env.DATABASE_URL
const db = drizzle(new Pool({ connectionString: dbUrl }), { schema })

const AGENT_NAMES = ['austin', 'rico', 'mei ann', 'angelica']

// Notion People ID → App User ID mapping
const NOTION_USER_MAP: Record<string, string> = {
  '302d872b-594c-812e-b163-0002cad480a1': 'SZhmXgNvsbr7lTn82faQwsuCQDAIRMww', // Oliver Porat
  '302d872b-594c-81c7-985f-0002c0078905': '4swwllSTcgO56HpJwNLVKXXLtYA0oUyZ', // Sean Phil
  '302d872b-594c-8127-9ef5-00025b242cea': 'GxerJx2mXicVBaYfippxwmeYbSGdEDTr', // Tri Pros Remodeling
}

const DEFAULT_OWNER_ID = 'SZhmXgNvsbr7lTn82faQwsuCQDAIRMww' // Oliver Porat fallback

// Seed users for dev DB (prod already has them via Google OAuth)
const SEED_USERS: { id: string, name: string, email: string }[] = [
  { id: 'SZhmXgNvsbr7lTn82faQwsuCQDAIRMww', name: 'Oliver Porat', email: 'oliver@triprosremodeling.com' },
  { id: '4swwllSTcgO56HpJwNLVKXXLtYA0oUyZ', name: 'Sean Phil', email: 'sean@triprosremodeling.com' },
  { id: 'GxerJx2mXicVBaYfippxwmeYbSGdEDTr', name: 'Tri Pros Remodeling', email: 'info@triprosremodeling.com' },
]

// ── Helpers ────────────────────────────────────────────────

function classifyContact(closedBy: string | null): {
  leadSource: 'telemarketing_leads_philippines' | 'noy' | 'quoteme' | 'other'
  leadType: 'appointment_set' | 'needs_confirmation' | 'manual'
} {
  if (!closedBy) {
    return { leadSource: 'other', leadType: 'manual' }
  }
  const lower = closedBy.toLowerCase().trim()
  if (AGENT_NAMES.some(n => lower.includes(n))) {
    return { leadSource: 'telemarketing_leads_philippines', leadType: 'appointment_set' }
  }
  if (lower.includes('quoteme')) {
    return { leadSource: 'quoteme', leadType: 'needs_confirmation' }
  }
  if (lower.includes('noy')) {
    return { leadSource: 'noy', leadType: 'needs_confirmation' }
  }
  return { leadSource: 'other', leadType: 'manual' }
}

async function findMp3InPage(page: PageObjectResponse): Promise<string | null> {
  for (const [, prop] of Object.entries(page.properties)) {
    if (prop.type !== 'files') {
      continue
    }
    for (const file of prop.files) {
      const url = file.type === 'file' ? file.file.url : file.type === 'external' ? file.external.url : null
      if (url && url.toLowerCase().includes('.mp3')) {
        return url
      }
    }
  }
  return null
}

async function downloadAndUploadMp3(url: string, customerId: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const key = `${customerId}/recordings/${Date.now()}-${crypto.randomUUID()}.mp3`

    await putObject(R2_BUCKETS.homeownerFiles, key, buffer, 'audio/mpeg')

    return key
  }
  catch (e) {
    console.error(`  MP3 upload failed for ${customerId}:`, e)
    return null
  }
}

function extractMeetingData(page: PageObjectResponse) {
  const p = page.properties

  const title = p['Meeting']?.type === 'title'
    ? p['Meeting'].title.map(t => t.plain_text).join('')
    : ''

  const datetime = p['Meeting Datetime']?.type === 'date'
    ? p['Meeting Datetime'].date?.start ?? null
    : null

  const contactRelation = p['Contact']?.type === 'relation'
    ? p['Contact'].relation.map(r => r.id)
    : []

  const salesreps = p['Salesreps Assigned']?.type === 'people'
    ? p['Salesreps Assigned'].people.map(u => u.id)
    : []

  const notes = p['Quick Notes']?.type === 'rich_text'
    ? p['Quick Notes'].rich_text.map(t => t.plain_text).join('')
    : ''

  const tradeRelationIds = p['Trades Interested']?.type === 'relation'
    ? p['Trades Interested'].relation.map(r => r.id)
    : []

  return {
    notionMeetingId: page.id,
    title,
    datetime,
    notionContactId: contactRelation[0] ?? null,
    salesrepNotionIds: salesreps,
    notes,
    tradeRelationIds,
    createdTime: page.created_time,
  }
}

async function insertQuickNoteIfMissing(
  customerId: string,
  content: string,
  authorId: string,
): Promise<boolean> {
  // Check if a note with this exact content already exists for this customer
  const [existing] = await db
    .select({ id: customerNotes.id })
    .from(customerNotes)
    .where(and(
      eq(customerNotes.customerId, customerId),
      eq(customerNotes.content, content),
    ))
    .limit(1)

  if (existing) {
    return false
  }

  await db.insert(customerNotes).values({ customerId, content, authorId })
  return true
}

function buildTradeSelections(
  tradeRelationIds: string[],
  tradeNameMap: Map<string, string>,
): TradeSelection[] {
  return tradeRelationIds
    .filter(id => tradeNameMap.has(id))
    .map(id => ({
      tradeId: id,
      tradeName: tradeNameMap.get(id)!,
      selectedScopes: [],
      painPoints: [],
    }))
}

// ── Phase 1: Contacts ──────────────────────────────────────

async function buildLeadSourceMap(): Promise<Map<string, string>> {
  const rows = await db.select({ slug: leadSourcesTable.slug, id: leadSourcesTable.id }).from(leadSourcesTable)
  return new Map(rows.map(r => [r.slug, r.id]))
}

async function migrateContacts(contactPages: PageObjectResponse[]) {
  console.log(`\n══ Phase 1: Contacts (${contactPages.length} found) ══\n`)

  const leadSourceIdBySlug = await buildLeadSourceMap()

  let inserted = 0
  let skipped = 0
  let mp3Synced = 0
  let errors = 0

  for (const page of contactPages) {
    try {
      const contact = pageToContact(page)

      // Read "Closed By" from raw properties (migration-only, not in permanent adapter)
      const closedByProp = page.properties['Closed By']
      let closedBy: string | null = null
      if (closedByProp?.type === 'select') {
        closedBy = closedByProp.select?.name ?? null
      }
      else if (closedByProp?.type === 'rich_text') {
        closedBy = closedByProp.rich_text.map(t => t.plain_text).join('') || null
      }

      const { leadSource: leadSourceSlug, leadType } = classifyContact(closedBy)
      const leadSourceId = leadSourceIdBySlug.get(leadSourceSlug) ?? null

      // Insert only — skip if customer already exists (PG is source of truth)
      const [row] = await db
        .insert(customers)
        .values({
          notionContactId: page.id,
          name: contact.name,
          phone: contact.phone ?? undefined,
          email: contact.email ?? undefined,
          address: contact.address ?? undefined,
          city: contact.city || '',
          state: contact.state ?? undefined,
          zip: contact.zip || '',
          leadSourceId,
          leadType,
        })
        .onConflictDoNothing({ target: customers.notionContactId })
        .returning({ id: customers.id })

      // For existing customers, look up their ID and check if MP3 is missing
      let customerId: string
      let isNew: boolean

      if (row) {
        customerId = row.id
        isNew = true
      }
      else {
        const [existing] = await db
          .select({ id: customers.id, leadMetaJSON: customers.leadMetaJSON })
          .from(customers)
          .where(eq(customers.notionContactId, page.id))
          .limit(1)

        if (!existing) {
          console.log(`Skipped (not found): ${contact.name}`)
          skipped++
          continue
        }

        // Already has MP3 — fully skip
        const meta = existing.leadMetaJSON as LeadMeta | null
        if (meta?.mp3RecordingKey) {
          console.log(`Skipped (exists, has MP3): ${contact.name}`)
          skipped++
          continue
        }

        customerId = existing.id
        isNew = false
      }

      // Upload MP3 if present (for both new and existing customers missing MP3)
      const mp3Url = await findMp3InPage(page)
      if (mp3Url) {
        console.log(`  Found MP3 for ${contact.name}, uploading…`)
        const key = await downloadAndUploadMp3(mp3Url, customerId)
        if (key) {
          await db
            .update(customers)
            .set({ leadMetaJSON: { mp3RecordingKey: key } })
            .where(eq(customers.id, customerId))
          mp3Synced++
        }
      }

      if (isNew) {
        console.log(`Inserted: ${contact.name} (${leadSourceSlug})`)
        inserted++
      }
      else {
        console.log(`MP3 backfilled: ${contact.name}`)
      }
    }
    catch (e) {
      console.error(`Error processing contact ${page.id}:`, e)
      errors++
    }
  }

  console.log(`\nContacts — Inserted: ${inserted} | Skipped: ${skipped} | MP3s synced: ${mp3Synced} | Errors: ${errors}`)
}

// ── Phase 2: Meetings ──────────────────────────────────────

async function migrateMeetings(meetingPages: PageObjectResponse[], tradeNameMap: Map<string, string>) {
  console.log(`\n══ Phase 2: Meetings (${meetingPages.length} found) ══\n`)

  let inserted = 0
  let skipped = 0
  let backfilled = 0
  let notesCreated = 0
  let errors = 0

  for (const page of meetingPages) {
    try {
      const data = extractMeetingData(page)

      // Skip meetings with no linked contact
      if (!data.notionContactId) {
        console.log(`Skipping "${data.title}" — no linked contact`)
        skipped++
        continue
      }

      // Look up the customer by notionContactId
      const [customer] = await db
        .select({ id: customers.id, name: customers.name })
        .from(customers)
        .where(eq(customers.notionContactId, data.notionContactId))
        .limit(1)

      if (!customer) {
        console.log(`Skipping "${data.title}" — customer not found for Notion contact ${data.notionContactId}`)
        skipped++
        continue
      }

      // Resolve the scheduledFor timestamp
      const scheduledFor = data.datetime ?? data.createdTime

      // Build trade selections from Notion relation
      const tradeSelections = buildTradeSelections(data.tradeRelationIds, tradeNameMap)
      const flowStateJSON: MeetingFlowState | undefined = tradeSelections.length > 0
        ? { tradeSelections }
        : undefined

      // Resolve ownerId: first salesrep mapped to app user, or fallback
      let ownerId = DEFAULT_OWNER_ID
      for (const notionRepId of data.salesrepNotionIds) {
        if (NOTION_USER_MAP[notionRepId]) {
          ownerId = NOTION_USER_MAP[notionRepId]
          break
        }
      }

      // Check for existing meeting (idempotent: same customer + same scheduledFor)
      const [existing] = await db
        .select({ id: meetings.id, flowStateJSON: meetings.flowStateJSON })
        .from(meetings)
        .where(and(
          eq(meetings.customerId, customer.id),
          eq(meetings.scheduledFor, scheduledFor),
        ))
        .limit(1)

      if (existing) {
        // Backfill trades into existing meeting if flowStateJSON is empty and we have trades
        if (!existing.flowStateJSON && flowStateJSON) {
          await db
            .update(meetings)
            .set({ flowStateJSON })
            .where(eq(meetings.id, existing.id))
          const tradeNames = tradeSelections.map(t => t.tradeName).join(', ')
          console.log(`Backfilled trades: "${data.title}" → [${tradeNames}]`)
          backfilled++
        }
        else {
          console.log(`Already exists: "${data.title}" — skipping`)
          skipped++
        }

        // Backfill quick note (idempotent — skip if note already exists for this customer)
        if (data.notes) {
          const created = await insertQuickNoteIfMissing(customer.id, data.notes, ownerId)
          if (created) {
            notesCreated++
          }
        }

        continue
      }

      await db.insert(meetings).values({
        ownerId,
        customerId: customer.id,
        scheduledFor,
        meetingOutcome: 'not_set',
        flowStateJSON,
      })

      // Insert quick note for new meeting
      if (data.notes) {
        const created = await insertQuickNoteIfMissing(customer.id, data.notes, ownerId)
        if (created) {
          notesCreated++
        }
      }

      const tradeNames = tradeSelections.map(t => t.tradeName).join(', ')
      console.log(`Inserted: "${data.title}" → ${customer.name}${tradeNames ? ` [${tradeNames}]` : ''} (owner: ${ownerId === DEFAULT_OWNER_ID ? 'Oliver (default)' : 'mapped'})`)
      inserted++
    }
    catch (e) {
      const title = (page.properties?.['Meeting'] as { type: 'title', title: Array<{ plain_text: string }> })?.title?.map(t => t.plain_text).join('') ?? page.id
      console.error(`Error processing meeting "${title}":`, e)
      errors++
    }
  }

  console.log(`\nMeetings — Inserted: ${inserted} | Backfilled: ${backfilled} | Notes: ${notesCreated} | Skipped: ${skipped} | Errors: ${errors}`)
}

// ── Main ───────────────────────────────────────────────────

async function main() {
  console.log('Fetching Notion contacts, meetings, and trades…')

  const [contactsRes, meetingsRes, tradesRes] = await Promise.all([
    notionClient.dataSources.query({ data_source_id: notionDatabasesMeta.contacts.id }),
    notionClient.dataSources.query({ data_source_id: notionDatabasesMeta.meetings.id }),
    notionClient.dataSources.query({ data_source_id: notionDatabasesMeta.trades.id }),
  ])

  const contactPages = contactsRes.results as PageObjectResponse[]
  const meetingPages = meetingsRes.results as PageObjectResponse[]
  const tradePages = tradesRes.results as PageObjectResponse[]

  // Build trade ID → name lookup from Notion trades database
  const tradeNameMap = new Map<string, string>()
  for (const page of tradePages) {
    const name = titleText(page.properties, 'Trade')
    if (name) {
      tradeNameMap.set(page.id, name)
    }
  }
  console.log(`Loaded ${tradeNameMap.size} trades from Notion`)

  // Phase 1: contacts first (meetings depend on customer IDs existing)
  await migrateContacts(contactPages)

  // Ensure mapped users exist (dev DB has no OAuth users yet)
  for (const u of SEED_USERS) {
    await db.insert(user).values({ id: u.id, name: u.name, email: u.email, emailVerified: false }).onConflictDoNothing()
  }

  // Phase 2: meetings (looks up customers by notionContactId, backfills trades)
  await migrateMeetings(meetingPages, tradeNameMap)

  console.log('\n══ Migration complete ══')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
