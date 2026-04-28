/* eslint-disable no-console */
/**
 * End-to-end short-path verification. Picks a real proposal with a short
 * SOW from the DB, clears its signingRequestId, creates a fresh draft via
 * contractService, inspects the Zoho draft to confirm it has exactly 1
 * file (template only — short path doesn't attach), and cleans up.
 *
 * Run: NODE_ENV=production DATABASE_URL=... ZOHO_SIGN_*=... \
 *      pnpm tsx scripts/verify-short-path.ts
 */
import assert from 'node:assert/strict'
import { Client } from 'pg'
import { contractService } from '@/shared/services/contract.service'
import { ZOHO_SIGN_BASE_URL } from '@/shared/services/zoho-sign/constants'
import { getZohoAccessToken } from '@/shared/services/zoho-sign/lib/get-access-token'

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  // Pick a proposal whose SOW plaintext-equivalent is small enough for the
  // short path. We approximate via the JSON length of the SOW array; that
  // overcounts (HTML markup adds bulk) so a 1500-char ceiling on the JSON
  // is a comfortable proxy for "short enough" without parsing every Tiptap.
  // Pick a real proposal with a real customer email + small SOW.
  // Real customer must have a valid email and an age (CSLB requirement).
  const { rows } = await client.query<{ id: string, sow_json_len: number, customer_name: string }>(`
    SELECT
      p.id,
      length(p."project_JSON"::text) AS sow_json_len,
      c.name AS customer_name
    FROM proposals p
    JOIN meetings m ON m.id = p.meeting_id
    JOIN customers c ON c.id = m.customer_id
    WHERE p.status IN ('sent', 'approved')
      AND c.email IS NOT NULL
      AND c.email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'
      AND c.customer_profile_json ? 'age'
      AND length(p."project_JSON"::text) < 4000
    ORDER BY length(p."project_JSON"::text) ASC
    LIMIT 5
  `)
  await client.end()

  if (rows.length === 0) {
    throw new Error('No suitable short-SOW proposal found — at least one sent/approved proposal needed in prod')
  }

  const target = rows[0]
  console.log(`Picked proposal ${target.id} for ${target.customer_name} (project_JSON length ≈ ${target.sow_json_len})`)

  const c2 = new Client({ connectionString: process.env.DATABASE_URL })
  await c2.connect()
  const before = await c2.query(`SELECT signing_request_id FROM proposals WHERE id = $1`, [target.id])
  const originalSigningRequestId = before.rows[0]?.signing_request_id ?? null
  await c2.query(`UPDATE proposals SET signing_request_id = NULL WHERE id = $1`, [target.id])
  await c2.end()
  console.log(`  cleared signing_request_id (was: ${originalSigningRequestId ?? 'NULL'})`)

  let createdRequestId: string | null = null
  try {
    const { requestId } = await contractService.createSigningRequest(target.id, null)
    createdRequestId = requestId
    console.log(`  draft created: ${requestId}`)

    const token = await getZohoAccessToken()
    const detailsRes = await fetch(`${ZOHO_SIGN_BASE_URL}/api/v1/requests/${requestId}`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    })
    const details = await detailsRes.json() as {
      requests: { document_ids?: Array<{ document_name: string }> }
    }
    const docs = details.requests.document_ids ?? []
    console.log(`  envelope has ${docs.length} files: ${docs.map(d => d.document_name).join(', ')}`)

    assert.equal(docs.length, 1, 'short path: envelope has 1 file (template only)')
    console.log('✅ short path verified')
  }
  finally {
    // Cleanup: delete the draft we created and restore the original signingRequestId.
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
      console.log(`  draft ${createdRequestId} deleted`)
    }
    const c3 = new Client({ connectionString: process.env.DATABASE_URL })
    await c3.connect()
    await c3.query(
      `UPDATE proposals SET signing_request_id = $1 WHERE id = $2`,
      [originalSigningRequestId, target.id],
    )
    await c3.end()
    console.log(`  restored original signing_request_id (${originalSigningRequestId ?? 'NULL'})`)
  }
}
main().catch((err) => { console.error(err); process.exit(1) })
