/* eslint-disable no-console */
/**
 * Replays the Zoho createdocument call for proposal baaf55ef-31b1-4393-b721-cdba21610021
 * against the live Zoho account, captures the real error (if any), and
 * immediately deletes the draft on success so nothing lingers.
 *
 * Run: DATABASE_URL=... pnpm tsx scripts/replay-zoho-draft.ts
 */

import { Client } from 'pg'
import { getZohoAccessToken } from '@/shared/services/zoho-sign/lib/get-access-token'
import { buildSigningRequest } from '@/shared/services/zoho-sign/lib/build-signing-request'
import { ZOHO_SIGN_BASE_URL } from '@/shared/services/zoho-sign/constants'

const PROPOSAL_ID = 'baaf55ef-31b1-4393-b721-cdba21610021'

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  const { rows: [p] } = await client.query(
    `SELECT id, status, sent_at, signing_request_id, owner_id, meeting_id,
            "project_JSON" AS project_json, "funding_JSON" AS funding_json,
            "form_meta_JSON" AS form_meta_json
       FROM proposals WHERE id = $1`,
    [PROPOSAL_ID],
  )
  if (!p) throw new Error('proposal not found')

  const { rows: [c] } = await client.query(
    `SELECT c.id, c.name, c.email, c.phone, c.address, c.city, c.state, c.zip,
            c.customer_profile_json
       FROM customers c JOIN meetings m ON m.customer_id = c.id WHERE m.id = $1`,
    [p.meeting_id],
  )
  if (!c) throw new Error('customer not found')

  await client.end()

  const proposal = {
    ...p,
    projectJSON: p.project_json,
    fundingJSON: p.funding_json,
    formMetaJSON: p.form_meta_json,
    customer: {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      address: c.address,
      city: c.city,
      state: c.state,
      zip: c.zip,
      customerAge: c.customer_profile_json?.age ?? null,
    },
  } as unknown as Parameters<typeof buildSigningRequest>[0]

  // Replay-only: actual production path counts pages from the generated
  // PDF. For this replay we pass a stand-in page count — the value flows
  // into the request `notes` field, doesn't affect template selection or
  // any signed-doc content.
  const { templateId, body } = buildSigningRequest(proposal, { sowPages: 1 })
  console.log('templateId:', templateId)

  const token = await getZohoAccessToken()
  const url = `${ZOHO_SIGN_BASE_URL}/api/v1/templates/${templateId}/createdocument?is_quicksend=false`
  const formBody = `data=${encodeURIComponent(JSON.stringify(body))}`
  console.log('POST size:', formBody.length, 'bytes')
  console.log('POST url:', url)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formBody,
  })
  const text = await res.text()
  console.log('\n=== ZOHO RESPONSE ===')
  console.log('HTTP', res.status, res.ok ? '✅' : '❌')
  console.log(text)

  if (res.ok) {
    try {
      const json = JSON.parse(text)
      const requestId = json?.requests?.request_id
      if (requestId) {
        console.log(`\nCleaning up test draft ${requestId}...`)
        const del = await fetch(`${ZOHO_SIGN_BASE_URL}/api/v1/requests/${requestId}/delete`, {
          method: 'PUT',
          headers: {
            Authorization: `Zoho-oauthtoken ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ recall_inprogress: true }),
        })
        console.log('delete HTTP', del.status, del.ok ? '✅' : '❌')
        if (!del.ok) console.log('delete body:', await del.text())
      }
    }
    catch (e) {
      console.log('parse failed:', e)
    }
  }
}

main().catch((err) => {
  console.error('SCRIPT ERROR:', err)
  process.exit(1)
})
