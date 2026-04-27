/* eslint-disable no-console */
import assert from 'node:assert/strict'
import { buildSigningRequest } from '@/shared/services/zoho-sign/lib/build-signing-request'

// Short path: tiny SOW content
const shortProposal = {
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
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Short scope of work.' }] }],
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

const short = buildSigningRequest(shortProposal)
assert.equal(short.mode, 'short', 'short SOW routes to short path')
assert.ok(short.body.templates.field_data.field_text_data['sow-1'].length > 0, 'sow-1 populated')
assert.equal(short.body.templates.field_data.field_text_data['sow-2'], '', 'sow-2 empty for tiny scope')
console.log('✅ short path')

// Long path: force mode=long, supply sowPages
const longProposal = {
  ...shortProposal,
  projectJSON: {
    data: {
      ...shortProposal.projectJSON.data,
      sow: Array.from({ length: 3 }, () => shortProposal.projectJSON.data.sow[0]),
    },
  },
} as unknown as Parameters<typeof buildSigningRequest>[0]

const long = buildSigningRequest(longProposal, { mode: 'long', sowPages: 3 })
assert.equal(long.mode, 'long')
assert.match(long.body.templates.field_data.field_text_data['sow-1'], /See attached.*3 pages/)
assert.equal(long.body.templates.field_data.field_text_data['sow-2'], '')
console.log('✅ long path')

// Long mode without sowPages throws
assert.throws(
  () => buildSigningRequest(longProposal, { mode: 'long' }),
  /sowPages required/,
  'throws when sowPages missing in long mode',
)
console.log('✅ long mode sowPages guard')

console.log('\n✅ buildSigningRequest branching verified')
