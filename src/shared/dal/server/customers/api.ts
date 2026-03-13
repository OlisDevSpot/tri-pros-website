import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { Customer } from '@/shared/db/schema/customers'
import type { Contact } from '@/shared/services/notion/lib/contacts/schema'
import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { meetings } from '@/shared/db/schema/meetings'
import { proposals } from '@/shared/db/schema/proposals'
import { queryNotionDatabase } from '@/shared/services/notion/dal/query-notion-database'
import { pageToContact } from '@/shared/services/notion/lib/contacts/adapter'

export type { Customer }

// ── Core upsert ──────────────────────────────────────────────────────────────

export async function upsertCustomerFromNotion(contact: Contact): Promise<Customer> {
  const now = new Date().toISOString()
  const [customer] = await db
    .insert(customers)
    .values({
      notionContactId: contact.id,
      name: contact.name,
      phone: contact.phone ?? null,
      email: contact.email ?? null,
      address: contact.address ?? null,
      city: contact.city ?? '',
      state: contact.state ?? null,
      zip: contact.zip ?? '',
      syncedAt: now,
    })
    .onConflictDoUpdate({
      target: customers.notionContactId,
      set: {
        name: contact.name,
        phone: contact.phone ?? null,
        email: contact.email ?? null,
        address: contact.address ?? null,
        city: contact.city ?? '',
        state: contact.state ?? null,
        zip: contact.zip ?? '',
        syncedAt: now,
      },
    })
    .returning()

  return customer
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export async function getCustomer(customerId: string): Promise<Customer | undefined> {
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
  return customer
}

export async function getCustomers(): Promise<Customer[]> {
  return db.select().from(customers)
}

export async function getCustomerByNotionId(notionContactId: string): Promise<Customer | undefined> {
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.notionContactId, notionContactId))
  return customer
}

// ── Full sync ─────────────────────────────────────────────────────────────────

export async function syncAllCustomers(): Promise<{ upserted: number }> {
  const pages = await queryNotionDatabase('contacts') as PageObjectResponse[] | undefined
  if (!pages)
    return { upserted: 0 }

  let upserted = 0
  for (const page of pages) {
    try {
      const contact = pageToContact(page)
      await upsertCustomerFromNotion(contact)
      upserted++
    }
    catch {
      // Skip malformed Notion contacts — do not abort the full sync
    }
  }
  return { upserted }
}

// ── One-time backfill ─────────────────────────────────────────────────────────

export async function backfillCustomers(): Promise<{ proposalsBackfilled: number, meetingsBackfilled: number }> {
  let proposalsBackfilled = 0
  let meetingsBackfilled = 0

  // Proposals with a notionPageId but no customerId
  const pendingProposals = await db
    .select({ id: proposals.id, notionPageId: proposals.notionPageId })
    .from(proposals)
    .where(and(isNotNull(proposals.notionPageId), isNull(proposals.customerId)))

  for (const proposal of pendingProposals) {
    try {
      const pages = await queryNotionDatabase('contacts', { id: proposal.notionPageId! }) as PageObjectResponse[]
      if (!pages?.[0])
        continue
      const contact = pageToContact(pages[0])
      const customer = await upsertCustomerFromNotion(contact)
      await db.update(proposals).set({ customerId: customer.id }).where(eq(proposals.id, proposal.id))
      proposalsBackfilled++
    }
    catch {
      // Skip on individual failure — do not abort the backfill
    }
  }

  // Meetings with a notionContactId but no customerId
  const pendingMeetings = await db
    .select({ id: meetings.id, notionContactId: meetings.notionContactId })
    .from(meetings)
    .where(and(isNotNull(meetings.notionContactId), isNull(meetings.customerId)))

  for (const meeting of pendingMeetings) {
    try {
      const pages = await queryNotionDatabase('contacts', { id: meeting.notionContactId! }) as PageObjectResponse[]
      if (!pages?.[0])
        continue
      const contact = pageToContact(pages[0])
      const customer = await upsertCustomerFromNotion(contact)
      await db.update(meetings).set({ customerId: customer.id }).where(eq(meetings.id, meeting.id))
      meetingsBackfilled++
    }
    catch {
      // Skip on individual failure
    }
  }

  return { proposalsBackfilled, meetingsBackfilled }
}
