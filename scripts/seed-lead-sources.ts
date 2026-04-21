import process from 'node:process'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { nanoid } from 'nanoid'
import { Pool } from 'pg'
import env from '../src/shared/config/server-env'
import * as schema from '../src/shared/db/schema'
import { leadSourcesTable } from '../src/shared/db/schema/lead-sources'

// Default: prod DB. Pass DRIZZLE_TARGET=dev to use dev DB.
const dbUrl = process.env.DRIZZLE_TARGET === 'dev' ? env.DATABASE_DEV_URL! : env.DATABASE_URL
const db = drizzle(new Pool({ connectionString: dbUrl }), { schema })

const LEAD_SOURCES = [
  {
    name: 'Manual',
    slug: 'manual',
    formConfigJSON: {
      mode: 'customer_only' as const,
      showEmail: true,
      requireEmail: false,
      showNotes: true,
      showMeetingScheduler: true,
      requireMeetingScheduler: false,
      showMp3Upload: true,
      closedByOptions: [],
    },
  },
  {
    name: 'Telemarketing Leads - Philippines',
    slug: 'telemarketing_leads_philippines',
    formConfigJSON: {
      mode: 'customer_and_meeting' as const,
      showEmail: false,
      requireEmail: false,
      showNotes: false,
      showMeetingScheduler: true,
      requireMeetingScheduler: true,
      showMp3Upload: true,
      closedByOptions: ['Austin', 'Rico', 'Mei Ann', 'Angelica'],
    },
  },
  {
    name: 'Noy',
    slug: 'noy',
    formConfigJSON: {
      mode: 'customer_only' as const,
      showEmail: true,
      requireEmail: false,
      showNotes: true,
    },
  },
  {
    name: 'QuoteMe',
    slug: 'quoteme',
    formConfigJSON: {
      mode: 'customer_only' as const,
      showEmail: true,
      requireEmail: false,
      showNotes: true,
    },
  },
  {
    name: 'Other',
    slug: 'other',
    formConfigJSON: {
      mode: 'customer_and_meeting' as const,
      showEmail: true,
      requireEmail: false,
      showNotes: true,
      showMeetingScheduler: true,
      requireMeetingScheduler: false,
      showMp3Upload: false,
    },
  },
]

async function main() {
  for (const source of LEAD_SOURCES) {
    const existing = await db
      .select({ id: leadSourcesTable.id })
      .from(leadSourcesTable)
      .where(eq(leadSourcesTable.slug, source.slug))
      .limit(1)

    if (existing.length > 0) {
      // Update formConfigJSON on existing rows to include new fields (e.g. mode)
      await db
        .update(leadSourcesTable)
        .set({ formConfigJSON: source.formConfigJSON })
        .where(eq(leadSourcesTable.slug, source.slug))
      console.log(`Updated "${source.name}" — formConfigJSON synced`)
      continue
    }

    const token = nanoid(21)
    await db.insert(leadSourcesTable).values({ ...source, token })
    console.log(`Created "${source.name}" with token: ${token}`)
    console.log(`   URL: /intake?source=${source.slug}`)
  }

  console.log('\nDone.')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
