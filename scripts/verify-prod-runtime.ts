/* eslint-disable no-console */
/**
 * REAL production runtime verification: dispatches the QStash job pointing
 * at the deployed Vercel function (not localhost, not tsx). If pdfkit's
 * AFM bundling fix landed, the job will succeed and write back a
 * signing_request_id. If the AFM files are still missing on Vercel, we'll
 * see signing_request_id stay NULL after retries exhaust.
 *
 * Targets the stuck "Test - LONG" proposal (16ba7459) since it's already
 * in the right state (sent + null signing_request_id).
 */
import { Client } from 'pg'
import { syncContractDraftJob } from '@/shared/services/upstash/jobs/sync-contract-draft'

const PROPOSAL_ID = '16ba7459-806c-4dab-8937-af7db3b80a6a'
const PROD_BASE_URL = 'https://www.triprosremodeling.com'

async function main() {
  // Override the dispatch URL so QStash callbacks go to prod, not localhost.
  process.env.NGROK_URL = ''
  process.env.NEXT_PUBLIC_BASE_URL = PROD_BASE_URL

  const c = new Client({ connectionString: process.env.DATABASE_URL })
  await c.connect()
  const before = await c.query(
    `SELECT signing_request_id, status FROM proposals WHERE id = $1`,
    [PROPOSAL_ID],
  )
  console.log(`pre-dispatch state: ${JSON.stringify(before.rows[0])}`)
  if (before.rows[0]?.signing_request_id != null) {
    console.log('  signing_request_id already set — clearing so we can retest')
    await c.query(`UPDATE proposals SET signing_request_id = NULL WHERE id = $1`, [PROPOSAL_ID])
  }
  await c.end()

  console.log(`\nDispatching QStash job → ${PROD_BASE_URL}/api/qstash-jobs?job=sync-contract-draft`)
  await syncContractDraftJob.dispatch({ proposalId: PROPOSAL_ID, ownerKey: null })
  console.log('  dispatched. QStash will POST to Vercel within seconds.\n')

  // Poll for signing_request_id to appear (or timeout).
  console.log('Polling for signing_request_id (up to 90s)...')
  const c2 = new Client({ connectionString: process.env.DATABASE_URL })
  await c2.connect()
  const startTime = Date.now()
  let lastReport = 0
  let result: { signing_request_id: string | null, updated_at: string } | null = null
  while (Date.now() - startTime < 90_000) {
    const { rows } = await c2.query(
      `SELECT signing_request_id, updated_at FROM proposals WHERE id = $1`,
      [PROPOSAL_ID],
    )
    result = rows[0]
    if (result?.signing_request_id) {
      break
    }
    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    if (elapsed >= lastReport + 10) {
      console.log(`  ${elapsed}s elapsed, still NULL`)
      lastReport = elapsed
    }
    await new Promise(r => setTimeout(r, 2000))
  }
  await c2.end()

  if (result?.signing_request_id) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    console.log(`\n✅ signing_request_id appeared after ${elapsed}s: ${result.signing_request_id}`)
    console.log('   Vercel runtime executed pdfmake successfully. AFM bundling fix CONFIRMED.')
  }
  else {
    console.log('\n❌ signing_request_id never appeared after 90s.')
    console.log('   Either the fix didn\'t work, or QStash hasn\'t finished retrying.')
    console.log('   Check Vercel function logs and Upstash QStash console.')
    process.exit(1)
  }
}
main().catch((err) => { console.error(err); process.exit(1) })
