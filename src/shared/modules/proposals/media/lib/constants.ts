// Canonical entity-name constant for the ProposalMediaFile entity. Source of
// truth for `EntityName` (see domains/permissions/abilities.ts). This is a pure
// CHILD entity: its `caslSubject` reuses the parent `Proposal` subject (no
// grants are defined against `ProposalMediaFile`); the distinct entityName
// exists only for precise error messages and greppability.
export const PROPOSAL_MEDIA_FILE = 'ProposalMediaFile' as const

/** Leaf identity for the proposal media unit. See the project twin for why this is separate from the store. */
export const PROPOSAL_MEDIA = {
  ownerKind: 'proposal',
  variants: ['xs', 'sm', 'md', 'lg'],
} as const
