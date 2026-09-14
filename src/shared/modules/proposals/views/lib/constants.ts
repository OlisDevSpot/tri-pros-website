// Canonical entity-name constant for the ProposalView entity. Source of truth
// for `EntityName` (see domains/permissions/abilities.ts). A pure CHILD entity:
// its `caslSubject` reuses the parent `Proposal` subject (no grants are defined
// against `ProposalView`); the distinct entityName exists for precise error
// messages and greppability — same shape as the media child.
export const PROPOSAL_VIEW = 'ProposalView' as const
