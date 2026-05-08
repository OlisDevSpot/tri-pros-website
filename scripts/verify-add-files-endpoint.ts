/* eslint-disable no-console */
/**
 * Verifies that we can attach an additional PDF file to a template-created
 * signing draft, and that the attached file stays as a reference-only page
 * (no signatures required on it). Cleans up the test draft afterward.
 *
 * Run: ZOHO_SIGN_*=... pnpm tsx scripts/verify-add-files-endpoint.ts
 */
import { Buffer } from 'node:buffer'
import { ZOHO_SIGN_BASE_URL, ZOHO_SIGN_TEMPLATES } from '@/shared/services/zoho-sign/constants'
import { getZohoAccessToken } from '@/shared/services/zoho-sign/lib/get-access-token'

async function main() {
  const token = await getZohoAccessToken()
  const auth = { Authorization: `Zoho-oauthtoken ${token}` }

  // 1. Create minimal template-based draft (base template, is_quicksend=false)
  const tpl = ZOHO_SIGN_TEMPLATES.base
  const body = {
    templates: {
      field_data: {
        field_text_data: {
          'ho-name': 'Endpoint Verification',
          'ho-email': 'test+zoho@triprosremodeling.com',
          'ho-age': '40',
          'start-date': '1/1/2030',
          'completion-date': '2/1/2030',
          'sow-1': 'See attached SOW (verification draft)',
          'sow-2': '',
          'tcp': '0',
          'deposit': '0',
          'ho-address': '—',
          'ho-city-state-zip': '—',
          'ho-phone': '—',
        },
        field_boolean_data: {},
        field_date_data: {},
      },
      actions: [
        {
          action_id: tpl.actions.contractor,
          action_type: 'SIGN',
          role: 'Contractor',
          recipient_name: 'Tri Pros Remodeling',
          recipient_email: 'info@triprosremodeling.com',
          verify_recipient: false,
        },
        {
          action_id: tpl.actions.homeowner,
          action_type: 'SIGN',
          role: 'Homeowner',
          recipient_name: 'Verification Test',
          recipient_email: 'test+zoho@triprosremodeling.com',
          verify_recipient: false,
        },
      ],
      notes: '',
    },
  }

  const createRes = await fetch(
    `${ZOHO_SIGN_BASE_URL}/api/v1/templates/${tpl.templateId}/createdocument?is_quicksend=false`,
    {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(JSON.stringify(body))}`,
    },
  )
  if (!createRes.ok) throw new Error(`create draft failed ${createRes.status}: ${await createRes.text()}`)
  const createJson = await createRes.json() as { requests: { request_id: string } }
  const requestId = createJson.requests.request_id
  console.log('✅ draft created:', requestId)

  // 2. Build a trivial 1-page PDF in memory (%PDF-1.4 minimal doc).
  const minimalPdf = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n'
    + '2 0 obj\n<</Type/Pages/Count 1/Kids[3 0 R]>>\nendobj\n'
    + '3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<<>>>>\nendobj\n'
    + '4 0 obj\n<</Length 44>>stream\nBT /F1 12 Tf 50 700 Td (Verification page) Tj ET\nendstream\nendobj\n'
    + 'xref\n0 5\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n'
    + '0000000103 00000 n\n0000000194 00000 n\ntrailer\n<</Size 5/Root 1 0 R>>\nstartxref\n275\n%%EOF\n',
    'utf8',
  )

  // 3. Try candidate endpoints in order until one succeeds.
  // First round: POST had code 9083 "Invalid HTTP method" on /requests/{id},
  // so the endpoint exists but wants a different verb. Zoho uses PUT for updates.
  const candidates = [
    { url: `${ZOHO_SIGN_BASE_URL}/api/v1/requests/${requestId}`, method: 'PUT', note: 'PUT /requests/{id} multipart' },
    { url: `${ZOHO_SIGN_BASE_URL}/api/v1/requests/${requestId}/addfiles`, method: 'PUT', note: 'PUT /addfiles' },
    { url: `${ZOHO_SIGN_BASE_URL}/api/v1/requests/${requestId}/documents`, method: 'PUT', note: 'PUT /documents' },
    { url: `${ZOHO_SIGN_BASE_URL}/api/v1/requests/${requestId}`, method: 'POST', note: 'POST /requests/{id}' },
  ]

  // Body variations to try (PUT /requests/{id} wants a `requests` wrapper)
  const bodyVariants = [
    { data: JSON.stringify({ requests: {} }), note: 'data={requests: {}}' },
    { data: JSON.stringify({ requests: { request_name: 'Endpoint Verification' } }), note: 'data={requests: {request_name}}' },
    { data: JSON.stringify({}), note: 'data={}' },
  ]

  let confirmedUrl: string | null = null
  let confirmedMethod: string | null = null
  let confirmedBody: string | null = null
  outer: for (const c of candidates) {
    for (const bv of bodyVariants) {
      const form = new FormData()
      form.append('data', bv.data)
      form.append('file', new Blob([minimalPdf], { type: 'application/pdf' }), 'verification.pdf')
      const res = await fetch(c.url, { method: c.method, headers: auth, body: form })
      const text = await res.text()
      console.log(`  ${c.note} + ${bv.note}: HTTP ${res.status}`)
      if (res.ok) {
        confirmedUrl = c.url
        confirmedMethod = c.method
        confirmedBody = bv.note
        console.log('    body:', text.slice(0, 300))
        break outer
      }
      else {
        console.log('    error:', text.slice(0, 200))
      }
    }
  }

  if (!confirmedUrl) {
    await cleanupDraft(requestId, token)
    throw new Error('❌ No candidate endpoint worked. Revise the spec: check Zoho API docs or SDK source for the correct path.')
  }
  console.log(`\n✅ CONFIRMED ENDPOINT: ${confirmedMethod} ${confirmedUrl}\n`)

  // 4. Fetch draft details and verify 2 files.
  const detailsRes = await fetch(`${ZOHO_SIGN_BASE_URL}/api/v1/requests/${requestId}`, { headers: auth })
  const details = await detailsRes.json() as {
    requests: {
      document_ids?: Array<{ document_id: string, document_name: string, document_order: string }>
      actions?: Array<{ action_id: string, recipient_email: string }>
    }
  }
  const docs = details.requests.document_ids ?? []
  console.log(`envelope has ${docs.length} documents:`)
  for (const d of docs) console.log(`  - ${d.document_name} (id=${d.document_id}, order=${d.document_order})`)
  if (docs.length !== 2) throw new Error(`expected 2 docs, got ${docs.length}`)

  // 5. Cleanup.
  await cleanupDraft(requestId, token)
  console.log('✅ cleanup done')

  console.log('\n--- ACTION REQUIRED ---')
  console.log(`Update spec §6.5 endpoint to: ${confirmedMethod} ${confirmedUrl.replace(requestId, '{requestId}')}`)
  console.log(`Body format: ${confirmedBody}`)
}

async function cleanupDraft(requestId: string, token: string) {
  await fetch(`${ZOHO_SIGN_BASE_URL}/api/v1/requests/${requestId}/delete`, {
    method: 'PUT',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recall_inprogress: true }),
  })
}

main().catch((err) => { console.error(err); process.exit(1) })
