import type { FundingSection } from '@/shared/entities/proposals/types'

/**
 * SANCTIONED BRIDGE — dies with W3's fundingJSON decomposition.
 * see `docs/plans/jsonb-decomposition-deprecation-ledger.md` (seam-tightening register)
 *
 * Since Wave 2, `proposal_incentives` rows are the only incentive truth; the
 * blob array must persist as `[]` (getFullView re-hydrates from rows). This
 * scrub turns that from caller discipline into a DAL guarantee. The tripwire
 * warning surfaces any unknown writer still sending blob incentives — if it
 * never fires, W3 deletes this file with the blob; if it fires, escalate
 * scrub→reject and fix the writer.
 */
export function scrubBlobIncentives(fundingJSON: FundingSection, context: string): FundingSection {
  if (fundingJSON.data.incentives.length === 0) {
    return fundingJSON
  }
  console.warn(
    `[proposals] scrub-with-tripwire: dropped ${fundingJSON.data.incentives.length} non-empty fundingJSON.data.incentives on ${context} — an unknown writer is bypassing replaceProposalIncentives (see jsonb deprecation ledger)`,
  )
  return { ...fundingJSON, data: { ...fundingJSON.data, incentives: [] } }
}
