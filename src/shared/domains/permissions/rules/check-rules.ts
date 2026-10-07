import type { PermissionRule } from '../types'

import type { UserRole } from '@/shared/constants/enums'

/**
 * Three facts the types cannot see, asserted when the rules load. CASL reads rules newest first and
 * ORs the conditioned ones, so a `can` after a `cannot` overrides it, and a bare rule beside a
 * conditioned one allows every row.
 */
export function assertRules(roles: { role: UserRole, rules: PermissionRule[] }[]): void {
  for (const { role, rules } of roles) {
    if (rules.length === 0) {
      throw new Error(`[rules] ${role} has no rules`)
    }
    const seen = new Map<string, { cannot: boolean, conditioned: boolean, bare: boolean }>()
    for (const rule of rules) {
      for (const action of [rule.action].flat()) {
        for (const subject of [rule.subject].flat()) {
          const key = `${action} ${String(subject)}`
          const entry = seen.get(key) ?? { cannot: false, conditioned: false, bare: false }
          if (rule.inverted) {
            entry.cannot = true
          }
          else {
            if (entry.cannot) {
              throw new Error(`[rules] ${role}: a can for '${key}' comes after a cannot, which it would override`)
            }
            if (rule.conditions) {
              entry.conditioned = true
            }
            else {
              entry.bare = true
            }
          }
          seen.set(key, entry)
        }
      }
    }
    for (const [key, entry] of seen) {
      if (entry.conditioned && entry.bare) {
        throw new Error(`[rules] ${role}: '${key}' has a can without conditions beside one with conditions; the bare one would allow every row`)
      }
    }
  }
}
