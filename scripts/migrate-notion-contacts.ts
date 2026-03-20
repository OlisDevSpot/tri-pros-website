/**
 * One-time migration: Notion Contacts → Postgres customers
 *
 * Run: pnpm tsx scripts/migrate-notion-contacts.ts
 *
 * Safety: Idempotent — uses onConflictDoUpdate on notionContactId.
 * Notion access: READ-ONLY. No Notion rows are modified.
 * MP3s: Downloaded from Notion signed URLs and re-uploaded to R2.
 *        Per-contact failure is logged and skipped, never aborts the run.
 */
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import process from 'node:process'
import { db } from '../src/shared/db'
import { customers } from '../src/shared/db/schema/customers'
import { notionClient } from '../src/shared/services/notion/client'
import { notionDatabasesMeta } from '../src/shared/services/notion/constants/databases'
import { pageToContact } from '../src/shared/services/notion/lib/contacts/adapter'
import { R2_BUCKETS } from '../src/shared/services/r2/buckets'
import { r2Client } from '../src/shared/services/r2/client'

// "Closed By" → leadSource / leadType mapping
const AGENT_NAMES = ['austin', 'rico', 'mei ann', 'angelica']

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

async function downloadAndUploadMp3(url: string, notionContactId: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const key = `recordings/migrated-${notionContactId}-${Date.now()}.mp3`

    await r2Client.send(new PutObjectCommand({
      Bucket: R2_BUCKETS.telemarketingRecordings,
      Key: key,
      Body: buffer,
      ContentType: 'audio/mpeg',
    }))

    return key
  }
  catch (e) {
    console.error(`  MP3 upload failed for ${notionContactId}:`, e)
    return null
  }
}

async function main() {
  console.log('Fetching all Notion contacts…')

  const response = await notionClient.dataSources.query({
    data_source_id: notionDatabasesMeta.contacts.id,
  })

  const pages = response.results as PageObjectResponse[]
  console.log(`Found ${pages.length} contacts\n`)

  let synced = 0
  let errors = 0

  for (const page of pages) {
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

      const { leadSource, leadType } = classifyContact(closedBy)

      // Check for MP3
      let mp3RecordingKey: string | undefined
      const mp3Url = await findMp3InPage(page)
      if (mp3Url) {
        console.log(`  Found MP3 for ${contact.name}, uploading…`)
        const key = await downloadAndUploadMp3(mp3Url, page.id)
        if (key) {
          mp3RecordingKey = key
        }
      }

      await db
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
          leadSource,
          leadType,
          leadMetaJSON: mp3RecordingKey ? { mp3RecordingKey } : undefined,
        })
        .onConflictDoUpdate({
          target: customers.notionContactId,
          set: {
            name: contact.name,
            phone: contact.phone ?? undefined,
            email: contact.email ?? undefined,
            address: contact.address ?? undefined,
            leadSource,
            leadType,
          },
        })

      console.log(`Synced: ${contact.name} (${leadSource})`)
      synced++
    }
    catch (e) {
      console.error(`Error processing page ${page.id}:`, e)
      errors++
    }
  }

  console.log(`\n--- Done ---`)
  console.log(`Synced: ${synced}`)
  console.log(`Errors: ${errors}`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
