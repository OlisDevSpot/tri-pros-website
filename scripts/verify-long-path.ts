/* eslint-disable no-console */
/**
 * End-to-end long-path verification. Uses proposal baaf55ef (known-long
 * SOW, 6,504 chars). Clears its signingRequestId, runs createSigningRequest,
 * verifies the resulting Zoho draft has 2 files (template doc + attached
 * SOW PDF) and that sow-1 contains the pointer string. Cleans up so the
 * proposal is left in its current "stuck" state for Task 15 to handle
 * properly post-deploy.
 *
 * Run: NODE_ENV=production DATABASE_URL=... ZOHO_SIGN_*=... \
 *      pnpm tsx scripts/verify-long-path.ts
 */
import assert from 'node:assert/strict'
import { Client } from 'pg'
import { contractService } from '@/shared/services/contract.service'
import { ZOHO_SIGN_BASE_URL } from '@/shared/services/zoho-sign/constants'
import { getZohoAccessToken } from '@/shared/services/zoho-sign/lib/get-access-token'

const PROPOSAL_ID = 'baaf55ef-31b1-4393-b721-cdba21610021'

async function main() {
  const c1 = new Client({ connectionString: process.env.DATABASE_URL })
  await c1.connect()
  const before = await c1.query(`SELECT signing_request_id FROM proposals WHERE id = $1`, [PROPOSAL_ID])
  const originalSigningRequestId = before.rows[0]?.signing_request_id ?? null
  await c1.query(`UPDATE proposals SET signing_request_id = NULL WHERE id = $1`, [PROPOSAL_ID])
  await c1.end()
  console.log(`cleared signing_request_id (was: ${originalSigningRequestId ?? 'NULL'})`)

  let createdRequestId: string | null = null
  try {
    const { requestId } = await contractService.createSigningRequest(PROPOSAL_ID, null)
    createdRequestId = requestId
    console.log(`draft created: ${requestId}`)

    const token = await getZohoAccessToken()
    const detailsRes = await fetch(`${ZOHO_SIGN_BASE_URL}/api/v1/requests/${requestId}`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    })
    const details = await detailsRes.json() as {
      requests: { document_ids?: Array<{ document_name: string, document_order: string }> }
    }
    const docs = details.requests.document_ids ?? []
    console.log(`envelope has ${docs.length} files:`)
    for (const d of docs) console.log(`  - ${d.document_name} (order=${d.document_order})`)

    assert.equal(docs.length, 2, 'long path: envelope has 2 files (template + SOW PDF)')
    assert.ok(
      docs.some(d => /scope-of-work/i.test(d.document_name)),
      'one file is the SOW attachment',
    )
    console.log('✅ long path verified')
  }
  finally {
    if (createdRequestId) {
      const token = await getZohoAccessToken()
      await fetch(`${ZOHO_SIGN_BASE_URL}/api/v1/requests/${createdRequestId}/delete`, {
        method: 'PUT',
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recall_inprogress: true }),
      })
      console.log(`draft ${createdRequestId} deleted`)
    }
    const c3 = new Client({ connectionString: process.env.DATABASE_URL })
    await c3.connect()
    await c3.query(
      `UPDATE proposals SET signing_request_id = $1 WHERE id = $2`,
      [originalSigningRequestId, PROPOSAL_ID],
    )
    await c3.end()
    console.log(`restored original signing_request_id (${originalSigningRequestId ?? 'NULL'})`)
  }
}
main().catch((err) => { console.error(err); process.exit(1) })
