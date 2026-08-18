import type { SQL } from 'drizzle-orm'

import type { SystemReason } from './system-reasons'
import type { AppAbility, AppSubject } from '@/shared/domains/permissions/types'

/**
 * Who is acting and how far their authority reaches. Replaces the ambient
 * `ScopedContext.scope: SQL | null` (spec §3), making "verb-checked but
 * row-unscoped" unrepresentable by accident.
 * - `user`   → role-based reach; scope is COMPILED from the ability's rules.
 * - `token`  → bearer (homeowner); reach is exactly its shared row(s), never null.
 * - `system` → the ONLY unrestricted actor, and it must say why (greppable/audited).
 */
export type Actor
  = | { kind: 'user', userId: string, ability: AppAbility }
    | { kind: 'token', scope: SQL, subject: AppSubject }
    | { kind: 'system', reason: SystemReason }

export function userActor(userId: string, ability: AppAbility): Actor {
  return { kind: 'user', userId, ability }
}

export function tokenActor(scope: SQL, subject: AppSubject): Actor {
  return { kind: 'token', scope, subject }
}

export function systemActor(reason: SystemReason): Actor {
  return { kind: 'system', reason }
}
