import { defineRules } from './define-rules'

// No code assigns this role; a homeowner reaches their proposal through its share link.
export function homeownerRules() {
  return defineRules((can) => {
    can('read', 'User')
  })
}
