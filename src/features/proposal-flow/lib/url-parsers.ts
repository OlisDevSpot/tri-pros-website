import { parseAsStringLiteral } from 'nuqs'

export const myProposalsStepParser = parseAsStringLiteral(['dashboard', 'past-proposals', 'create-proposal', 'proposal'] as const).withDefault('past-proposals').withOptions({
  clearOnDefault: false,
})
