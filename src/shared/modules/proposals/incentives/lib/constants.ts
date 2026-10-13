// Canonical entity-name constant for the ProposalIncentive entity. Source of
// truth for `EntityName` (see domains/permissions/abilities.ts). A pure CHILD
// entity: it is the field `incentives` of the `Proposal` subject (no grants are
// defined against `ProposalIncentive`); the distinct entityName exists for
// precise error messages and greppability — same shape as the views/media children.
export const PROPOSAL_INCENTIVE = 'ProposalIncentive' as const
