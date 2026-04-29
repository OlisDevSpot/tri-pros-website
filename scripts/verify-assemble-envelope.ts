/* eslint-disable no-console */
/**
 * End-to-end smoke test for the Phase 4 registry-driven envelope
 * assembler. Builds a fake ProposalContext (no DB), calls
 * assembleEnvelope directly, creates a real DRAFT envelope in Zoho.
 *
 * Run: pnpm tsx scripts/verify-assemble-envelope.ts <recipient-email>
 *
 * The created draft is left in Zoho — clean it up via the Sign UI or
 * a follow-up DELETE /requests/{id} call.
 */
import type { ProposalContext } from '@/shared/services/zoho-sign/documents/types'
import { assembleEnvelope } from '@/shared/services/zoho-sign/documents/assemble-envelope'

function makeFakeContext(recipientEmail: string): ProposalContext {
  // Upsell + short SOW + non-senior is the smallest envelope that
  // exercises the registry-driven path: required = [awd], no
  // sow-pdf (forbidden when !isLongSow on upsell). Avoids the SOW
  // PDF generator's DB hit, so the smoke test runs without a real
  // proposal row.
  const proposal = {
    id: 'fake-proposal-phase-4-smoke-test',
    label: 'Phase 4 smoke test',
    formMetaJSON: {
      pricingMode: 'total',
      envelopeDocumentIds: ['awd'],
    },
    projectJSON: {
      data: {
        sow: [{
          contentJSON: JSON.stringify({
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Phase 4 smoke-test additional work.' }] }],
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
      data: { depositAmount: 500, startingTcp: 7500, incentives: [], cashInDeal: 7000 },
    },
    customer: {
      id: 'fake-customer',
      name: 'Phase 4 Test Customer',
      phone: '555-0100',
      email: recipientEmail,
      address: '123 Phase 4 St',
      city: 'Anytown',
      state: 'CA',
      zip: '90210',
      customerAge: 45,
    },
    meetingProjectId: 'fake-existing-project-uuid',
  } as unknown as ProposalContext['proposal']

  return {
    proposal,
    scenario: 'upsell',
    isSenior: false,
    isLongSow: false,
    finalTcp: 7500,
    sowText: 'Phase 4 smoke-test additional work.',
    // Synthetic original-contract-date 60 days ago — exercises the
    // Phase 4.5 wiring without needing a real project lookup.
    originalContractDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
  }
}

async function main() {
  const recipientEmail = process.argv[2]
  if (!recipientEmail) {
    console.error('Usage: pnpm tsx scripts/verify-assemble-envelope.ts <recipient-email>')
    process.exit(1)
  }

  const ctx = makeFakeContext(recipientEmail)
  console.log('=== assembleEnvelope smoke test ===')
  console.log(`scenario: ${ctx.scenario}`)
  console.log(`docs: ${ctx.proposal.formMetaJSON.envelopeDocumentIds?.join(', ')}`)
  console.log(`recipient: ${recipientEmail}`)
  console.log()

  const { requestId, status, documentIds } = await assembleEnvelope(ctx)
  console.log('--- Result ---')
  console.log(`requestId:    ${requestId}`)
  console.log(`status:       ${status}`)
  console.log(`documents:    ${documentIds.join(', ')}`)
  console.log(`\nLeave the draft alone OR delete via Zoho UI / DELETE /api/v1/requests/${requestId}`)
  console.log('Inspect the draft in your Zoho dashboard — should show:')
  console.log('  - 1 document: tpr-additional-work-standalone')
  console.log('  - 1 envelope-level Homeowner recipient (no Contractor — AWD is homeowner-only)')
  console.log('  - sow field populated with the SOW text; price-adjustment = 7500')
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})
