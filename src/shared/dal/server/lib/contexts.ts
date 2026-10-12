import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'

import type { AnyServerSpec, ScopedContext } from '../types'
import type { SystemReason } from '@/shared/domains/permissions/rules/system'

import { eq } from 'drizzle-orm'

import { db } from '@/shared/db'
import { abilityFromRules } from '@/shared/domains/permissions/ability-from-rules'
import { BEARER_RULES } from '@/shared/domains/permissions/rules/bearer'
import { systemRules } from '@/shared/domains/permissions/rules/system'

import { subjectOf } from './define-spec'
import { pkColumnOf } from './permissions/core'

/** An unrestricted context for jobs, webhooks and server-derived writes. The reason rides on the rule, so every privileged site is named. */
export function systemContext(reason: SystemReason): ScopedContext {
  return { actor: { ability: abilityFromRules(systemRules(reason)), userId: null }, scope: null }
}

/**
 * The context a share link gives its holder: that one row's share-link rules. Nothing when the token
 * names no row, so a wrong token and a missing row look the same.
 */
export async function bearerContext(spec: AnyServerSpec, token: string): Promise<ScopedContext | null> {
  const rulesFor = BEARER_RULES[subjectOf(spec)]
  const tokenColumnName = spec.shareable?.tokenColumn
  if (!rulesFor || !tokenColumnName) {
    throw new Error(`[bearerContext] ${spec.entityName} has no share-link rules`)
  }
  // Drizzle's PgTable does not expose its columns as a keyed record.
  const tokenColumn = (spec.table as unknown as Record<string, PgColumn | undefined>)[tokenColumnName]
  if (!tokenColumn) {
    throw new Error(`[bearerContext] '${tokenColumnName}' is not a column of ${spec.entityName}'s table`)
  }
  const [row] = await db
    .select({ id: pkColumnOf(spec) })
    .from(spec.table as PgTable)
    .where(eq(tokenColumn, token))
    .limit(1)
  return row ? { actor: { ability: abilityFromRules(rulesFor(String(row.id))), userId: null }, scope: null } : null
}
