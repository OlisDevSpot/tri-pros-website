/* eslint-disable node/prefer-global/process */
import { eq, sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'

async function main() {
  const closedByOptions = ['Austin', 'Rico', 'Mei Ann', 'Angelica']

  const [updated] = await db
    .update(leadSourcesTable)
    .set({
      formConfigJSON: sql`jsonb_set(form_config_json, '{closedByOptions}', ${JSON.stringify(closedByOptions)}::jsonb)`,
    })
    .where(eq(leadSourcesTable.slug, 'telemarketing_leads_philippines'))
    .returning({ slug: leadSourcesTable.slug })

  if (updated) {
    console.log(`Updated ${updated.slug} with closedByOptions: ${closedByOptions.join(', ')}`)
  }
  else {
    console.error('No lead source found with slug "telemarketing_leads_philippines"')
  }

  process.exit(0)
}

main()
