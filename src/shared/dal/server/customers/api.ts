import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { Customer } from '@/shared/db/schema/customers'
import type { Contact } from '@/shared/services/notion/lib/contacts/schema'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
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
