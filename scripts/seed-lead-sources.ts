import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import process from 'node:process'
import { db } from '../src/shared/db'
import { leadSourcesTable } from '../src/shared/db/schema/lead-sources'

const INITIAL_SOURCES = [
  {
    name: 'Telemarketing Leads - Philippines',
    slug: 'telemarketing_leads_philippines',
    formConfigJSON: {
      leadType: 'appointment_set' as const,
      showEmail: false,
      requireEmail: false,
      showMeetingScheduler: true,
      requireMeetingScheduler: true,
      showMp3Upload: true,
      showNotes: false,
    },
  },
  {
    name: 'Noy',
    slug: 'noy',
    formConfigJSON: {
      leadType: 'needs_confirmation' as const,
      showEmail: true,
      requireEmail: false,
      showMeetingScheduler: false,
      requireMeetingScheduler: false,
      showMp3Upload: false,
      showNotes: true,
    },
  },
  {
    name: 'QuoteMe',
    slug: 'quoteme',
    formConfigJSON: {
      leadType: 'needs_confirmation' as const,
      showEmail: true,
      requireEmail: false,
      showMeetingScheduler: false,
      requireMeetingScheduler: false,
      showMp3Upload: false,
      showNotes: true,
    },
  },
  {
    name: 'Other',
    slug: 'other',
    formConfigJSON: {
      leadType: 'manual' as const,
      showEmail: true,
      requireEmail: false,
      showMeetingScheduler: true,
      requireMeetingScheduler: false,
      showMp3Upload: false,
      showNotes: true,
    },
  },
]

async function main() {
  for (const source of INITIAL_SOURCES) {
    const existing = await db
      .select({ id: leadSourcesTable.id })
      .from(leadSourcesTable)
      .where(eq(leadSourcesTable.slug, source.slug))
      .limit(1)

    if (existing.length > 0) {
      console.log(`Skipping "${source.name}" — already exists`)
      continue
    }

    const token = nanoid(21)
    await db.insert(leadSourcesTable).values({ ...source, token })
    console.log(`Seeded "${source.name}" with token: ${token}`)
    console.log(`   URL: /intake/${token}`)
  }

  console.log('\nDone. Store these tokens securely — they are permanent.')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
