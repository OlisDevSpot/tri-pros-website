/**
 * One-off script: creates the "Bina" lead source.
 * Run: npx tsx scripts/seed-bina-lead-source.ts
 */
import '@/shared/config/server-env'

import { randomBytes } from 'node:crypto'

import { eq } from 'drizzle-orm'

import { db } from '@/shared/db'
import { leadSourcesTable } from '@/shared/db/schema'

async function main() {
  const existing = await db.query.leadSourcesTable.findFirst({
    where: eq(leadSourcesTable.slug, 'bina'),
  })

  if (existing) {
    console.log('✓ Bina lead source already exists:', existing.id)
    return
  }

  const [created] = await db.insert(leadSourcesTable).values({
    name: 'Bina',
    slug: 'bina',
    token: randomBytes(16).toString('hex'),
    formConfigJSON: {
      mode: 'customer_only',
      showEmail: true,
      requireEmail: false,
      showNotes: false,
    },
    isActive: true,
  }).returning()

  console.log('✓ Created Bina lead source:', created.id)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('✗ Failed to seed Bina lead source:', err)
    process.exit(1)
  })
