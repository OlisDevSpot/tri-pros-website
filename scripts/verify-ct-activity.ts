/* eslint-disable no-console */
/**
 * One-off live probe: confirm CloudTalk's Activities endpoint
 * (PUT /activity/add/{contactId}.json) works with our hand-typed request +
 * response schema, against a real CT contact. Writes ONE clearly-labelled
 * "Lead details" activity (safe to delete in the CT UI).
 *
 * Run: pnpm exec tsx scripts/verify-ct-activity.ts
 * Uses the CloudTalk creds from .env(.local) via load-env.
 */
import './lib/load-env'

import { cloudtalkClient } from '@/shared/services/providers/cloudtalk/client'

async function main() {
  const list = await cloudtalkClient.listContacts({ limit: 1 })
  const contactId = list.data[0]?.Contact.id
  if (!contactId) {
    console.error('[verify:ct-activity] no contacts in CloudTalk to probe against')
    process.exit(1)
  }
  console.log(`[verify:ct-activity] probing contactId=${contactId}`)

  const res = await cloudtalkClient.addContactActivity({
    contactId,
    name: 'Lead details',
    description: '📋 Lead details\nAPI verification probe — safe to delete',
  })

  console.log('[verify:ct-activity] OK →', res)
  process.exit(0)
}

main().catch((err) => {
  console.error('[verify:ct-activity] FAILED', err)
  process.exit(1)
})
