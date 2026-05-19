import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { SQL } from 'drizzle-orm'
import type { Customer } from '@/shared/db/schema/customers'
import type { Contact } from '@/shared/services/providers/notion/lib/contacts/schema'
import { and, eq, getTableColumns, inArray } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'
import { meetings } from '@/shared/db/schema/meetings'
import { proposals } from '@/shared/db/schema/proposals'
import { gatedPhoneSql, hasSentProposalSql } from '@/shared/entities/customers/lib/phone-gating-sql'
import { queryNotionDatabase } from '@/shared/services/providers/notion/dal/query-notion-database'
import { pageToContact } from '@/shared/services/providers/notion/lib/contacts/adapter'
import { userCanSeeCustomer } from './visibility'

export type { Customer }

export type CustomerWithPhoneGate = Customer & { hasSentProposal: boolean }

// Viewer context for the customers DAL. Carries both:
//   - userId:        for agent-scoped row visibility (via userCanSeeCustomer)
//   - isSuperAdmin:  bypasses scoping AND ungates the phone column
// Every customers read must pass a viewer; non-omni viewers can only see
// customers they participate in via the meetings/meeting_participants bridge.
export interface CustomersViewer {
  userId: string
  isSuperAdmin: boolean
}

function customerVisibilityWhere(viewer: CustomersViewer): SQL | undefined {
  return viewer.isSuperAdmin
    ? undefined
    : userCanSeeCustomer(viewer.userId, customers.id)
}

function customerSelectWithGate(viewer: CustomersViewer) {
  // Override the raw `phone` column with the gated expression so consumers
  // that destructure `...customer` can't accidentally leak the ungated value.
  const { phone: _phone, ...rest } = getTableColumns(customers)
  return {
    ...rest,
    phone: gatedPhoneSql(viewer.isSuperAdmin),
    hasSentProposal: hasSentProposalSql(),
  }
}

// ── Core upsert ──────────────────────────────────────────────────────────────

export async function upsertCustomerFromNotion(contact: Contact): Promise<Customer> {
  const now = new Date().toISOString()
  const [customer] = await db
    .insert(customers)
    .values({
      notionContactId: contact.id,
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      address: contact.address,
      city: contact.city,
      state: contact.state,
      zip: contact.zip,
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

// ── Homeowner-based find-or-create (no Notion required) ─────────────────────

interface HomeownerData {
  name: string
  email: string
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
}

export async function findOrCreateCustomerFromHomeowner(data: HomeownerData): Promise<Customer> {
  // Try to find existing customer by email
  const [existing] = await db
    .select()
    .from(customers)
    .where(eq(customers.email, data.email))
    .limit(1)

  if (existing) {
    return existing
  }

  const [customer] = await db
    .insert(customers)
    .values({
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      address: data.address ?? null,
      city: data.city ?? '',
      state: data.state ?? null,
      zip: data.zip ?? '',
      syncedAt: new Date().toISOString(),
    })
    .returning()

  return customer
}

// ── Webhook-based create (lead source by slug) ────────────────────────────────

interface WebhookCustomerData {
  name: string
  phone: string
  email?: string | null
  city: string
  zip: string
  state?: string | null
  leadSourceSlug: string
}

export async function createCustomerFromWebhook(data: WebhookCustomerData): Promise<Customer> {
  const { leadSourceSlug, ...customerData } = data

  // Resolve lead source slug → id
  const [leadSource] = await db
    .select({ id: leadSourcesTable.id })
    .from(leadSourcesTable)
    .where(eq(leadSourcesTable.slug, leadSourceSlug))
    .limit(1)

  if (!leadSource) {
    throw new Error(`Lead source "${leadSourceSlug}" not found`)
  }

  const [customer] = await db
    .insert(customers)
    .values({
      ...customerData,
      email: customerData.email ?? null,
      state: customerData.state ?? 'CA',
      leadSourceId: leadSource.id,
    })
    .returning()

  return customer
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export async function getCustomer(customerId: string, viewer: CustomersViewer): Promise<CustomerWithPhoneGate | undefined> {
  const [customer] = await db
    .select(customerSelectWithGate(viewer))
    .from(customers)
    .where(and(eq(customers.id, customerId), customerVisibilityWhere(viewer)))
  return customer
}

export async function getCustomers(viewer: CustomersViewer): Promise<CustomerWithPhoneGate[]> {
  return db
    .select(customerSelectWithGate(viewer))
    .from(customers)
    .where(customerVisibilityWhere(viewer))
}

// ── Hard delete ───────────────────────────────────────────────────────────────

// Permanent customer delete. The schema sets `meetings.customerId` and
// `proposals.meetingId` to NULL on parent delete (would orphan rows that show
// up in lists with no owner), so we manually delete proposals → meetings
// before the customer. The customer row itself cascades to `customer_notes`
// and `projects` via the schema FKs.
export async function deleteCustomer(customerId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const customerMeetings = await tx
      .select({ id: meetings.id })
      .from(meetings)
      .where(eq(meetings.customerId, customerId))

    const meetingIds = customerMeetings.map(m => m.id)

    if (meetingIds.length > 0) {
      await tx.delete(proposals).where(inArray(proposals.meetingId, meetingIds))
      await tx.delete(meetings).where(inArray(meetings.id, meetingIds))
    }

    await tx.delete(customers).where(eq(customers.id, customerId))
  })
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
