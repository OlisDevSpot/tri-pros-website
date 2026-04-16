/* eslint-disable no-console, node/prefer-global/process */
/**
 * One-time migration: customer_notes + meetings.agentNotes → activities table.
 *
 * Run:
 *   pnpm migrate:notes:dev   (dev DB)
 *   pnpm migrate:notes       (prod DB)
 *
 * Idempotent — safe to re-run. Checks for existing activity before inserting.
 */
import process from 'node:process'

import { and, eq, isNotNull } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import env from '../src/shared/config/server-env'
import * as schema from '../src/shared/db/schema'
import { activities } from '../src/shared/db/schema/activities'
import { user } from '../src/shared/db/schema/auth'
import { customerNotes } from '../src/shared/db/schema/customer-notes'
import { meetings } from '../src/shared/db/schema/meetings'

// ── DB Connection (respects DRIZZLE_TARGET) ───────────────────

const dbUrl = process.env.DRIZZLE_TARGET === 'dev' ? env.DATABASE_DEV_URL! : env.DATABASE_URL
const db = drizzle(new Pool({ connectionString: dbUrl }), { schema })

/** Resolve a fallback ownerId for notes with null authorId */
let _fallbackOwnerId: string | null = null
async function getFallbackOwnerId(): Promise<string> {
  if (_fallbackOwnerId) {
    return _fallbackOwnerId
  }
  const [superAdmin] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.role, 'super-admin'))
    .limit(1)
  if (!superAdmin) {
    throw new Error('No super-admin user found to use as fallback owner for orphaned notes')
  }
  _fallbackOwnerId = superAdmin.id
  return _fallbackOwnerId
}

// ── Helpers ───────────────────────────────────────────────────

function extractTitle(content: string, maxLen = 80): string {
  const firstLine = content.split('\n')[0] ?? ''
  return firstLine.length > maxLen ? firstLine.slice(0, maxLen) : firstLine
}

// ── Phase 1: customer_notes → activities ──────────────────────

async function migrateCustomerNotes(): Promise<{ migrated: number, skipped: number }> {
  const notes = await db.select().from(customerNotes)
  let migrated = 0
  let skipped = 0

  for (const note of notes) {
    const existing = await db
      .select({ id: activities.id })
      .from(activities)
      .where(
        and(
          eq(activities.entityType, 'customer'),
          eq(activities.entityId, note.customerId),
          eq(activities.type, 'note'),
          eq(activities.description, note.content),
        ),
      )
      .limit(1)

    if (existing.length > 0) {
      skipped++
      continue
    }

    await db.insert(activities).values({
      type: 'note',
      title: extractTitle(note.content),
      description: note.content,
      entityType: 'customer',
      entityId: note.customerId,
      ownerId: note.authorId ?? await getFallbackOwnerId(),
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    })

    migrated++
  }

  return { migrated, skipped }
}

// ── Phase 2: meetings.agentNotes → activities ─────────────────

async function migrateMeetingNotes(): Promise<{ migrated: number, skipped: number }> {
  const meetingsWithNotes = await db
    .select()
    .from(meetings)
    .where(isNotNull(meetings.agentNotes))

  let migrated = 0
  let skipped = 0

  for (const meeting of meetingsWithNotes) {
    const agentNotes = meeting.agentNotes!

    const existing = await db
      .select({ id: activities.id })
      .from(activities)
      .where(
        and(
          eq(activities.entityType, 'meeting'),
          eq(activities.entityId, meeting.id),
          eq(activities.type, 'note'),
          eq(activities.description, agentNotes),
        ),
      )
      .limit(1)

    if (existing.length > 0) {
      skipped++
      continue
    }

    await db.insert(activities).values({
      type: 'note',
      title: extractTitle(agentNotes),
      description: agentNotes,
      entityType: 'meeting',
      entityId: meeting.id,
      ownerId: meeting.ownerId,
      createdAt: meeting.createdAt,
      updatedAt: meeting.updatedAt,
    })

    migrated++
  }

  return { migrated, skipped }
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  const target = process.env.DRIZZLE_TARGET === 'dev' ? 'DEV' : 'PROD'
  console.log(`=== Notes → Activities Migration (${target}) ===\n`)

  console.log('Migrating customer_notes...')
  const customerResult = await migrateCustomerNotes()
  console.log(`  Migrated: ${customerResult.migrated}, Skipped: ${customerResult.skipped}`)

  console.log('\nMigrating meeting agentNotes...')
  const meetingResult = await migrateMeetingNotes()
  console.log(`  Migrated: ${meetingResult.migrated}, Skipped: ${meetingResult.skipped}`)

  const total = customerResult.migrated + meetingResult.migrated
  const totalSkipped = customerResult.skipped + meetingResult.skipped
  console.log(`\n=== Done. Migrated: ${total}, Skipped: ${totalSkipped} ===`)
  process.exit(0)
}

main().catch((err) => {
  console.error('\nMigration failed:', err)
  process.exit(1)
})
