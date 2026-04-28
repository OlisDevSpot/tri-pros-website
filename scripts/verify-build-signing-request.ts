/* eslint-disable no-console */
import assert from 'node:assert/strict'
import { buildSigningRequest } from '@/shared/services/zoho-sign/lib/build-signing-request'

const proposal = {
  customer: {
    customerAge: 40,
    name: 'Test Customer',
    email: 'test@example.com',
    phone: '',
    address: '',
    city: 'LA',
    state: 'CA',
    zip: '90000',
  },
  projectJSON: {
    data: {
      sow: [{
        contentJSON: JSON.stringify({
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Scope of work.' }] }],
        }),
        html: '',
        scopes: [],
        title: 'Test',
        trade: { id: 't', label: 'T' },
      }],
      validThroughTimeframe: '60 days',
    },
  },
  fundingJSON: {
    data: { depositAmount: 1000, startingTcp: 5000, incentives: [], cashInDeal: 4000 },
  },
} as unknown as Parameters<typeof buildSigningRequest>[0]

const result = buildSigningRequest(proposal, { sowPages: 3 })
const fields = result.body.templates.field_data.field_text_data

// Templates were trimmed: sow-1 / sow-2 must NOT be in field_text_data anymore.
// Sending unknown labels is silently ignored by Zoho but it's dead weight + a
// confusing signal in payload-inspection logs.
assert.equal('sow-1' in fields, false, 'sow-1 must not be sent (template field removed)')
assert.equal('sow-2' in fields, false, 'sow-2 must not be sent (template field removed)')

// Core fields the template actually has.
assert.equal(fields['ho-name'], 'Test Customer')
assert.equal(fields['ho-email'], 'test@example.com')
assert.equal(fields['ho-age'], '40')
assert.equal(fields['tcp'], '5000')
assert.equal(fields.deposit, '1000')

// Page-count flows into the envelope notes for signer context.
assert.match(result.body.templates.notes, /3 pages/)

// sowPages is required.
assert.throws(
  () => buildSigningRequest(proposal, undefined as unknown as { sowPages: number }),
  /Cannot/,
  'throws when options missing',
)

console.log('✅ field_text_data has no sow-1/sow-2')
console.log('✅ core homeowner + financial fields populated')
console.log('✅ sowPages page-count surfaced in envelope notes')
console.log('\n✅ buildSigningRequest verified (post-trim, always-attach-PDF shape)')
