import { defineRules } from './define-rules'

export function superAdminRules() {
  return defineRules((can) => {
    can('manage', 'all')
  })
}
