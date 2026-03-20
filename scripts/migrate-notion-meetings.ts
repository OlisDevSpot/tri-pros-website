/**
 * One-time migration: Notion Meetings → Postgres meetings
 *
 * Run: pnpm tsx scripts/migrate-notion-meetings.ts
 *
 * Prerequisites: Run migrate-notion-contacts.ts first (needs customers with notionContactId).
 * Safety: Idempotent — checks for existing meeting by matching customerId + scheduledFor.
 * Notion access: READ-ONLY.
 */
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { and, eq } from 'drizzle-orm'
import process from 'node:process'
import { db } from '../src/shared/db'
import { customers } from '../src/shared/db/schema/customers'
import { meetings } from '../src/shared/db/schema/meetings'
import { notionClient } from '../src/shared/services/notion/client'
import { notionDatabasesMeta } from '../src/shared/services/notion/constants/databases'

// Notion People ID → App User ID mapping
const NOTION_USER_MAP: Record<string, string> = {
  '302d872b-594c-812e-b163-0002cad480a1': 'SZhmXgNvsbr7lTn82faQwsuCQDAIRMww', // Oliver Porat
  '302d872b-594c-81c7-985f-0002c0078905': '4swwllSTcgO56HpJwNLVKXXLtYA0oUyZ', // Sean Phil
  '302d872b-594c-8127-9ef5-00025b242cea': 'GxerJx2mXicVBaYfippxwmeYbSGdEDTr', // Tri Pros Remodeling
}

const DEFAULT_OWNER_ID = 'SZhmXgNvsbr7lTn82faQwsuCQDAIRMww' // Oliver Porat fallback

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

  const notes = p['Notes']?.type === 'rich_text'
    ? p['Notes'].rich_text.map(t => t.plain_text).join('')
    : ''

  return {
    notionMeetingId: page.id,
    title,
    datetime,
    notionContactId: contactRelation[0] ?? null,
    salesrepNotionIds: salesreps,
    notes,
    createdTime: page.created_time,
  }
}

async function main() {
  console.log('Fetching all Notion meetings…')

  const response = await notionClient.dataSources.query({
    data_source_id: notionDatabasesMeta.meetings.id,
  })

  const pages = response.results as PageObjectResponse[]
  console.log(`Found ${pages.length} meetings\n`)

  let synced = 0
  let skipped = 0
  let errors = 0

  for (const page of pages) {
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

      // Check for existing meeting (idempotent: same customer + same scheduledFor)
      const [existing] = await db
        .select({ id: meetings.id })
        .from(meetings)
        .where(and(
          eq(meetings.customerId, customer.id),
          eq(meetings.scheduledFor, scheduledFor),
        ))
        .limit(1)

      if (existing) {
        console.log(`Already exists: "${data.title}" — skipping`)
        skipped++
        continue
      }

      // Resolve ownerId: first salesrep mapped to app user, or fallback
      let ownerId = DEFAULT_OWNER_ID
      for (const notionRepId of data.salesrepNotionIds) {
        if (NOTION_USER_MAP[notionRepId]) {
          ownerId = NOTION_USER_MAP[notionRepId]
          break
        }
      }

      // Extract contact name from meeting title (strip " - fresh lead" etc.)
      const contactName = data.title.replace(/\s*-\s*(fresh lead|rehash|follow.?up|new lead).*$/i, '').trim() || customer.name

      await db.insert(meetings).values({
        ownerId,
        customerId: customer.id,
        contactName,
        scheduledFor,
        status: 'completed',
      })

      console.log(`Synced: "${data.title}" → ${customer.name} (owner: ${ownerId === DEFAULT_OWNER_ID ? 'Oliver (default)' : 'mapped'})`)
      synced++
    }
    catch (e) {
      const title = (page.properties?.['Meeting'] as { type: 'title', title: Array<{ plain_text: string }> })?.title?.map(t => t.plain_text).join('') ?? page.id
      console.error(`Error processing meeting "${title}":`, e)
      errors++
    }
  }

  console.log(`\n--- Done ---`)
  console.log(`Synced: ${synced}`)
  console.log(`Skipped: ${skipped}`)
  console.log(`Errors: ${errors}`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
