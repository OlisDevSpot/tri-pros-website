import { defineRules } from './define-rules'

// Authenticated homeowners only — most use token-based access instead. Proposal read has no
// "own" condition because proposals link through Meeting → Customer; the token gate covers it today.
export function homeownerRules() {
  return defineRules((can) => {
    can('read', 'Proposal')
    can('read', 'User')
  })
}
