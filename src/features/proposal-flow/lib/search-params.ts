import { createLoader, parseAsString } from 'nuqs/server'

export const proposalSearchParams = {
  view: parseAsString,
}

export const loadProposalSearchParams = createLoader(proposalSearchParams)
