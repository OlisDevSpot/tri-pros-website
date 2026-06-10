/* eslint-disable no-console */
/**
 * One-off live probe: confirm CloudTalk's Notes endpoint
 * (PUT /notes/add/{contactId}.json) works with our hand-typed request +
 * response schema, against a real CT contact. Writes ONE clearly-labelled
 * note to the contact card (safe to delete in the CT UI).
 *
 * Run: pnpm exec tsx scripts/verify-ct-note.ts
 * Uses the CloudTalk creds from .env(.local) via load-env.
 */
import './lib/load-env'

import { cloudtalkClient } from '@/shared/services/providers/cloudtalk/client'

async function main() {
  const list = await cloudtalkClient.listContacts({ limit: 1 })
  const contactId = list.data[0]?.Contact.id
  if (!contactId) {
    console.error('[verify:ct-note] no contacts in CloudTalk to probe against')
    process.exit(1)
  }
  console.log(`[verify:ct-note] probing contactId=${contactId}`)

  const res = await cloudtalkClient.addContactNote({
    contactId,
    note: 'Lead details · API verification probe — safe to delete',
  })

  console.log('[verify:ct-note] OK →', res)
  process.exit(0)
}

main().catch((err) => {
  console.error('[verify:ct-note] FAILED', err)
  process.exit(1)
})
