import type { Meeting } from '@/shared/db/schema'
import type { DealStructure } from '@/shared/entities/meetings/schemas'
import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { buildProposalDefaults } from './build-proposal-defaults'

function meetingWithDeal(dealStructure: DealStructure): Meeting {
  return { flowStateJSON: { dealStructure } } as unknown as Meeting
}

describe('buildProposalDefaults deposit', () => {
  it('keeps a meeting deposit within the cap as the override', () => {
    const defaults = buildProposalDefaults(meetingWithDeal({ mode: 'cash', startingTcp: 20_000, incentives: [], depositAmount: 800 }), null)
    assert.equal(defaults.funding.depositAmount, 800)
  })
  it('keeps a meeting deposit exactly at the cap', () => {
    const defaults = buildProposalDefaults(meetingWithDeal({ mode: 'cash', startingTcp: 7300, incentives: [], depositAmount: 730 }), null)
    assert.equal(defaults.funding.depositAmount, 730)
  })
  it('leaves the deposit to the cap when the meeting figure is above it', () => {
    const defaults = buildProposalDefaults(meetingWithDeal({ mode: 'cash', startingTcp: 7300, incentives: [], depositAmount: 1000 }), null)
    assert.equal(defaults.funding.depositAmount, null)
  })
  it('caps against the price after the meeting incentives', () => {
    // $10,000 less a $500 discount is $9,500, whose cap is $950.
    const incentives = [{ label: 'Neighbor', source: 'agent', amount: 500 }]
    const defaults = buildProposalDefaults(meetingWithDeal({ mode: 'cash', startingTcp: 10_000, incentives, depositAmount: 1000 }), null)
    assert.equal(defaults.funding.depositAmount, null)
  })
  it('reads a meeting deposit of 0 as not set, so the cap applies', () => {
    const defaults = buildProposalDefaults(meetingWithDeal({ mode: 'cash', startingTcp: 20_000, incentives: [], depositAmount: 0 }), null)
    assert.equal(defaults.funding.depositAmount, null)
  })
  it('leaves the deposit to the cap when the meeting has none', () => {
    const defaults = buildProposalDefaults(meetingWithDeal({ mode: 'finance', startingTcp: 20_000, incentives: [] }), null)
    assert.equal(defaults.funding.depositAmount, null)
  })
})
