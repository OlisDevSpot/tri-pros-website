/**
 * One-time migration: links every proposal to a customer via a meeting.
 *
 * For each proposal:
 *   1. Check notionPageId → find existing customer by notionContactId
 *   2. If customer exists, upsert data from proposal's homeownerJSON/projectJSON
 *   3. If no customer, create one from proposal data
 *   4. Create a shell meeting (status: completed) linking customer ↔ proposal
 *
 * Run with: pnpm tsx scripts/migrate-customers.ts
 * Safe to re-run — skips proposals that already have a meetingId.
 */

import { eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { meetings } from '@/shared/db/schema/meetings'
import { proposals } from '@/shared/db/schema/proposals'

async function main() {
  console.log('=== Customer Migration ===')
  console.log(`Started at ${new Date().toISOString()}\n`)

  // Fetch all proposals without a meetingId
  const orphans = await db
    .select({
      id: proposals.id,
      ownerId: proposals.ownerId,
      notionPageId: proposals.notionPageId,
      homeownerName: sql<string | null>`"proposals"."homeowner_JSON"->'data'->>'name'`,
      homeownerEmail: sql<string | null>`"proposals"."homeowner_JSON"->'data'->>'email'`,
      homeownerPhone: sql<string | null>`"proposals"."homeowner_JSON"->'data'->>'phoneNum'`,
      projectAddress: sql<string | null>`${proposals.projectJSON}->'data'->>'address'`,
      projectCity: sql<string | null>`${proposals.projectJSON}->'data'->>'city'`,
      projectState: sql<string | null>`${proposals.projectJSON}->'data'->>'state'`,
      projectZip: sql<string | null>`${proposals.projectJSON}->'data'->>'zip'`,
    })
    .from(proposals)
    .where(isNull(proposals.meetingId))

  console.log(`Found ${orphans.length} proposals without meetingId\n`)

  let migrated = 0
  let errors = 0

  for (const p of orphans) {
    try {
      let customerId: string | null = null

      // 1. If proposal has a notionPageId, check if a customer already exists with that notionContactId
      if (p.notionPageId) {
        const [existing] = await db
          .select({ id: customers.id })
          .from(customers)
          .where(eq(customers.notionContactId, p.notionPageId))
          .limit(1)

        if (existing) {
          customerId = existing.id
          // Upsert: fill any gaps on the customer from proposal data
          await db.update(customers).set({
            name: p.homeownerName ?? undefined,
            phone: p.homeownerPhone ?? undefined,
            email: p.homeownerEmail ?? undefined,
            address: p.projectAddress ?? undefined,
            city: p.projectCity || undefined,
            state: p.projectState ?? undefined,
            zip: p.projectZip || undefined,
          }).where(eq(customers.id, customerId))
        }
      }

      // 2. If no customer found via Notion, try by email
      if (!customerId && p.homeownerEmail) {
        const [existing] = await db
          .select({ id: customers.id })
          .from(customers)
          .where(eq(customers.email, p.homeownerEmail))
          .limit(1)

        if (existing) {
          customerId = existing.id
        }
      }

      // 3. If still no customer, create one from proposal data
      if (!customerId) {
        const [newCustomer] = await db
          .insert(customers)
          .values({
            notionContactId: p.notionPageId ?? undefined,
            name: p.homeownerName ?? 'Unknown',
            email: p.homeownerEmail,
            phone: p.homeownerPhone,
            address: p.projectAddress,
            city: p.projectCity ?? '',
            state: p.projectState,
            zip: p.projectZip ?? '',
            syncedAt: new Date().toISOString(),
          })
          .returning({ id: customers.id })

        customerId = newCustomer.id
      }

      // 4. Create shell meeting linking customer ↔ proposal
      const [shellMeeting] = await db
        .insert(meetings)
        .values({
          ownerId: p.ownerId,
          customerId,
          contactName: p.homeownerName,
          status: 'completed',
        })
        .returning({ id: meetings.id })

      await db
        .update(proposals)
        .set({ meetingId: shellMeeting.id })
        .where(eq(proposals.id, p.id))

      migrated++
      console.log(`  ✓ ${p.homeownerName ?? 'Unknown'} (${p.homeownerEmail ?? 'no email'})`)
    }
    catch (err) {
      errors++
      const cause = err instanceof Error && err.cause ? `\n    Cause: ${err.cause}` : ''
      console.error(`  ✗ Proposal ${p.id}: ${err instanceof Error ? err.message : String(err)}${cause}`)
    }
  }

  // Summary
  const [{ count: totalCustomers }] = await db.select({ count: sql<number>`count(*)` }).from(customers)
  const [{ count: remainingOrphans }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(proposals)
    .where(isNull(proposals.meetingId))

  console.log(`\n=== Done ===`)
  console.log(`  Migrated: ${migrated}`)
  console.log(`  Errors: ${errors}`)
  console.log(`  Total customers: ${totalCustomers}`)
  console.log(`  Remaining orphan proposals: ${remainingOrphans}`)

  // eslint-disable-next-line node/prefer-global/process
  process.exit(0)
}

main().catch((err) => {
  console.error('Migration failed:', err)
  // eslint-disable-next-line node/prefer-global/process
  process.exit(1)
})
