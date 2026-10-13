import { defineRules } from './define-rules'

// "Own record" is enforced at the DAL layer.
export function userRules() {
  return defineRules((can) => {
    can('read', 'User')
  })
}
