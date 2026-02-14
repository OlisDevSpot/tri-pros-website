import { parseAsString, parseAsStringLiteral } from 'nuqs'

export const myProposalsStepParser = parseAsStringLiteral(['dashboard', 'past-proposals', 'create-proposal', 'edit-proposal', 'proposal'] as const).withDefault('past-proposals').withOptions({
  clearOnDefault: false,
})

export const proposalIdParser = parseAsString.withDefault('').withOptions({
  clearOnDefault: true,
})
