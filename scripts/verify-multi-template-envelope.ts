/* eslint-disable no-console */
/**
 * Phase 1 research spike: confirms POST /api/v1/templates/mergesend works
 * and that listing the same homeowner email under multiple action_ids
 * produces ONE signing experience for that recipient (not N).
 *
 * Creates a DRAFT envelope (is_quicksend=false) merging:
 *   - tpr-esign-waiver-standalone (homeowner-only signer)
 *   - tpr-senior-ack-standalone   (homeowner-only signer)
 *
 * After creation, GETs the request and dumps the structure:
 *   - documents[]    (should be 2)
 *   - actions[]      (should be 1 unified Homeowner OR 2 entries that
 *                     Zoho still treats as one recipient downstream)
 *
 * Run: pnpm tsx scripts/verify-multi-template-envelope.ts <recipient-email>
 *
 * The draft is left in Zoho — clean it up via Sign UI or a follow-up
 * DELETE /requests/{id} call.
 */
import { getZohoAccessToken } from '@/shared/services/zoho-sign/lib/get-access-token'

const ESIGN_WAIVER_TEMPLATE = '563034000000079183'
const ESIGN_WAIVER_HOMEOWNER_ACTION = '563034000000079195'

const SENIOR_ACK_TEMPLATE = '563034000000079147'
const SENIOR_ACK_HOMEOWNER_ACTION = '563034000000079160'

// Existing main HI senior template (for the 3-template, 2-recipient scenario)
const MAIN_HI_SENIOR_TEMPLATE = '563034000000055081'
const MAIN_HI_SENIOR_CONTRACTOR_ACTION = '563034000000055125'
const MAIN_HI_SENIOR_HOMEOWNER_ACTION = '563034000000055136'

async function main() {
  const recipientEmail = process.argv[2]
  if (!recipientEmail) {
    console.error('Usage: pnpm tsx scripts/verify-multi-template-envelope.ts <recipient-email>')
    console.error('  Example: pnpm tsx scripts/verify-multi-template-envelope.ts test@example.com')
    process.exit(1)
  }

  const token = await getZohoAccessToken()
  const today = new Date().toLocaleDateString('en-US')

  // Three-template, two-recipient scenario:
  //   tpr-HI-senior (Contractor + Homeowner)
  // + tpr-senior-ack (Homeowner only)
  // + tpr-esign-waiver (Homeowner only)
  // ⇒ Expected merged actions: 1 Contractor + 1 Homeowner (all 3 homeowner action_ids dedupe)
  const data = {
    templates: {
      field_data: {
        field_text_data: {
          'ho-name': 'Test Recipient',
          'ho-email': recipientEmail,
          'ho-phone': '555-0100',
          'ho-address': '123 Test St',
          'ho-city-state-zip': 'Anytown, CA 90210',
          'ho-age': '67',
          'start-date': today,
          'completion-date': today,
          'tcp': '50000',
          'deposit': '5000',
          'sow-1': 'Test SOW line 1',
          'sow-2': '',
        },
        field_boolean_data: {},
        field_date_data: {
          'sent-date': today,
        },
        field_radio_data: {},
      },
      actions: [
        {
          recipient_name: 'Tri Pros Remodeling',
          recipient_email: 'info@triprosremodeling.com',
          action_id: MAIN_HI_SENIOR_CONTRACTOR_ACTION,
          action_type: 'SIGN',
          signing_order: 1,
          role: 'Contractor',
          verify_recipient: false,
          private_notes: '',
        },
        {
          recipient_name: 'Test Recipient',
          recipient_email: recipientEmail,
          action_id: MAIN_HI_SENIOR_HOMEOWNER_ACTION,
          action_type: 'SIGN',
          signing_order: 2,
          role: 'Homeowner',
          verify_recipient: false,
          private_notes: '',
        },
        {
          recipient_name: 'Test Recipient',
          recipient_email: recipientEmail,
          action_id: SENIOR_ACK_HOMEOWNER_ACTION,
          action_type: 'SIGN',
          signing_order: 2,
          role: 'Homeowner',
          verify_recipient: false,
          private_notes: '',
        },
        {
          recipient_name: 'Test Recipient',
          recipient_email: recipientEmail,
          action_id: ESIGN_WAIVER_HOMEOWNER_ACTION,
          action_type: 'SIGN',
          signing_order: 2,
          role: 'Homeowner',
          verify_recipient: false,
          private_notes: '',
        },
      ],
      notes: '',
    },
  }

  const body = new URLSearchParams()
  body.set('template_ids', JSON.stringify([
    MAIN_HI_SENIOR_TEMPLATE,
    SENIOR_ACK_TEMPLATE,
    ESIGN_WAIVER_TEMPLATE,
  ]))
  body.set('data', JSON.stringify(data))
  body.set('is_quicksend', 'false')

  console.log('=== POST /api/v1/templates/mergesend ===')
  console.log('templates:', [MAIN_HI_SENIOR_TEMPLATE, SENIOR_ACK_TEMPLATE, ESIGN_WAIVER_TEMPLATE])
  console.log(`actions: ${data.templates.actions.length} (1 Contractor, 3 Homeowner — expect 2 after dedupe)`)
  console.log('is_quicksend: false (draft)\n')

  const res = await fetch('https://sign.zoho.com/api/v1/templates/mergesend', {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const json = await res.json() as Record<string, unknown>
  console.log('--- Response status:', res.status, '---')
  console.log(JSON.stringify(json, null, 2))

  if (res.status !== 200 && res.status !== 201) {
    console.error('\n❌ mergesend failed')
    process.exit(1)
  }

  const requestId = (json as { requests?: { request_id?: string } }).requests?.request_id
  if (!requestId) {
    console.error('\n❌ no request_id in response')
    process.exit(1)
  }

  console.log(`\n✅ Draft created: request_id=${requestId}`)

  // Re-fetch the request to see the unified structure
  console.log('\n=== GET /api/v1/requests/' + requestId + ' ===')
  const detail = await fetch(`https://sign.zoho.com/api/v1/requests/${requestId}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  })
  const detailJson = await detail.json() as {
    requests?: {
      request_status?: string
      document_ids?: { document_id: string; document_name: string }[]
      actions?: Record<string, unknown>[]
    }
  }

  const r = detailJson.requests
  if (!r) {
    console.error('Could not retrieve request detail')
    process.exit(1)
  }

  console.log(`request_status: ${r.request_status}`)
  console.log(`documents (${r.document_ids?.length ?? 0}):`)
  for (const d of r.document_ids ?? []) {
    console.log(`  - ${d.document_id} ${d.document_name}`)
  }
  console.log(`actions (${r.actions?.length ?? 0}):`)
  for (const a of r.actions ?? []) {
    console.log(`  - action_id=${String(a.action_id)} recipient_id=${String(a.recipient_id ?? '(none)')} email=${String(a.recipient_email)} name=${String(a.recipient_name)} role=${String(a.role)} order=${String(a.signing_order)} status=${String(a.action_status)}`)
  }

  // Recipient-unification verdict:
  //   - If there's a single recipient_id across both action entries -> Zoho consolidated; ONE signing email/session
  //   - If each action has its own recipient_id (or none) and the homeowner gets two emails -> NOT consolidated
  const recipientIds = new Set((r.actions ?? []).map(a => String(a.recipient_id ?? a.action_id)))
  console.log(`\nUnique recipient_ids across all actions: ${recipientIds.size}`)
  console.log(recipientIds.size === 1
    ? '✅ Recipient unification confirmed — Zoho treats this as ONE signing experience'
    : '⚠️  Multiple recipient_ids — Zoho may send separate signing emails. Inspect manually.')

  console.log(`\nLeave this draft alone OR delete via Zoho UI / DELETE /api/v1/requests/${requestId}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
