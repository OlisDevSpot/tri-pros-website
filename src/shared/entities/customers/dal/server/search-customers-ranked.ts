// LAZY: customers is still a plain entity; this moves to modules/customers/core/dal/server with the promotion.
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { CustomerMatchField } from '@/shared/entities/customers/dal/server/customer-search-rank-sql'

import { and, desc, sql } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { customerSearchSql, WORD_SIMILARITY_THRESHOLD } from '@/shared/entities/customers/dal/server/customer-search-rank-sql'
import { parseCustomerSearch } from '@/shared/entities/customers/lib/customer-search-tokens'
import { canSeeUngatedPhone, gatedPhoneSql } from '@/shared/entities/customers/lib/phone-gating-sql'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import 'server-only'

export interface RankedCustomer {
  id: string
  name: string
  city: string
  address: string | null
  zip: string
  state: string | null
  email: string | null
  /** Gated: null when the caller may not see it. */
  phone: string | null
  score: number
  matchedOn: CustomerMatchField
}

/** Customers the caller can read, best match first. Phone matching uses the gated value, so it can't reveal a hidden number. */
export async function searchCustomersRanked(ctx: ScopedContext, term: string, limit: number): Promise<DalReturn<RankedCustomer[]>> {
  return dalDbOperation(async () => {
    const gatedPhone = gatedPhoneSql(canSeeUngatedPhone(ctx.actor.ability))
    const rank = customerSearchSql(parseCustomerSearch(term), gatedPhone)
    if (!rank) {
      return []
    }
    return db.transaction(async (tx) => {
      // `<%` and `<<%` read their thresholds from these settings; `true` scopes them to this transaction.
      const threshold = String(WORD_SIMILARITY_THRESHOLD)
      await tx.execute(sql`SELECT set_config('pg_trgm.word_similarity_threshold', ${threshold}, true), set_config('pg_trgm.strict_word_similarity_threshold', ${threshold}, true)`)
      return tx
        .select({
          id: customers.id,
          name: customers.name,
          city: customers.city,
          address: customers.address,
          zip: customers.zip,
          state: customers.state,
          email: customers.email,
          phone: gatedPhone,
          score: rank.score,
          matchedOn: rank.matchedOn,
        })
        .from(customers)
        .where(and(permit(ctx, 'read', customerServerSpec).sql, rank.where))
        .orderBy(desc(rank.score), desc(customers.updatedAt))
        .limit(limit)
    })
  })
}
