/* eslint-disable no-console */
/**
 * Read-only diagnostic for proposal baaf55ef-31b1-4393-b721-cdba21610021.
 * Inspects raw DB data + simulates buildSigningRequest against it to catch
 * silent errors or malformed bodies without actually calling Zoho.
 *
 * Run: pnpm tsx scripts/inspect-failed-proposal.ts
 */

import { Client } from 'pg'
import { buildSigningRequest } from '@/shared/services/zoho-sign/lib/build-signing-request'

const PROPOSAL_ID = 'baaf55ef-31b1-4393-b721-cdba21610021'

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  const { rows: propRows } = await client.query(
    `SELECT id, status, sent_at, contract_sent_at, signing_request_id, owner_id,
            meeting_id, label, "project_JSON" AS project_json,
            "funding_JSON" AS funding_json, "form_meta_JSON" AS form_meta_json,
            token, created_at, updated_at
       FROM proposals WHERE id = $1`,
    [PROPOSAL_ID],
  )

  if (propRows.length === 0) {
    console.log(`❌ Proposal ${PROPOSAL_ID} NOT FOUND in DATABASE_URL target`)
    await client.end()
    return
  }

  const p = propRows[0]
  console.log('✅ Proposal found')
  console.log('  status:             ', p.status)
  console.log('  sent_at:            ', p.sent_at)
  console.log('  contract_sent_at:   ', p.contract_sent_at)
  console.log('  signing_request_id: ', p.signing_request_id)
  console.log('  owner_id:           ', p.owner_id)
  console.log('  meeting_id:         ', p.meeting_id)
  console.log('  updated_at:         ', p.updated_at)

  const { rows: custRows } = await client.query(
    `SELECT c.id, c.name, c.email, c.phone, c.address, c.city, c.state, c.zip,
            c.customer_profile_json
       FROM customers c
       JOIN meetings m ON m.customer_id = c.id
       WHERE m.id = $1`,
    [p.meeting_id],
  )

  if (custRows.length === 0) {
    console.log('\n⚠️  No customer via meeting — buildSigningRequest would crash on customer?.customerAge')
    await client.end()
    return
  }

  const c = custRows[0]
  const age = c.customer_profile_json?.age ?? null
  console.log('\n--- CUSTOMER ---')
  console.log('  name:               ', c.name)
  console.log('  email:              ', c.email)
  console.log('  phone:              ', c.phone)
  console.log('  address:            ', c.address)
  console.log('  city/state/zip:     ', `${c.city}, ${c.state} ${c.zip}`)
  console.log('  customerAge:        ', age)

  const projData = p.project_json?.data ?? {}
  console.log('\n--- PROJECT JSON ---')
  console.log('  validThroughTimeframe:', JSON.stringify(projData.validThroughTimeframe))
  console.log('  sow entries count:    ', Array.isArray(projData.sow) ? projData.sow.length : 'not-array')

  const fundData = p.funding_json?.data ?? {}
  console.log('\n--- FUNDING JSON ---')
  console.log('  depositAmount:      ', fundData.depositAmount, '(type:', typeof fundData.depositAmount, ')')
  console.log('  cashInDeal:         ', fundData.cashInDeal)
  console.log('  funding keys:       ', Object.keys(fundData).sort())

  console.log('\n=== SIMULATING buildSigningRequest ===')
  try {
    const proposal = {
      ...p,
      customerId: null,
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
        customerAge: age,
      },
    } as unknown as Parameters<typeof buildSigningRequest>[0]

    // Inspection-only: pass a stand-in sowPages — production counts pages
    // from the generated PDF, but here we only simulate body construction.
    const req = buildSigningRequest(proposal, { sowPages: 1 })
    console.log('✅ buildSigningRequest SUCCESS')
    console.log('  templateId:        ', req.templateId)
    const ft = req.body.templates.field_data.field_text_data as Record<string, string>
    for (const [k, v] of Object.entries(ft)) {
      const s = String(v)
      const flag = s === 'undefined' || s === 'null' || s === 'NaN' || s === '' ? '  ⚠️  ' : '     '
      console.log(`${flag}${k.padEnd(22)}: ${s.length > 80 ? `${s.slice(0, 77)}...(len=${s.length})` : s}`)
    }
    const actions = req.body.templates.actions
    console.log('  actions:           ')
    for (const a of actions) {
      console.log(`    - ${a.role}: action_id=${a.action_id}, email=${a.recipient_email}`)
    }

    const totalLen = Object.values(ft).reduce((n, v) => n + String(v).length, 0)
    console.log(`\n  total field_text_data payload length: ${totalLen} chars`)

    const body = `data=${encodeURIComponent(JSON.stringify(req.body))}`
    console.log(`  URL-encoded body length:              ${body.length} bytes`)
  }
  catch (error) {
    console.log('❌ buildSigningRequest THREW:')
    console.log('  ', (error as Error).message)
  }

  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
