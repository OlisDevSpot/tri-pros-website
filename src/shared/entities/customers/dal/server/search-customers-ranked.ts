// src/shared/entities/customers/dal/server/search-customers-ranked.ts
// LAZY: customers is still a plain entity; this moves to modules/customers/core/dal/server with the promotion.
import type { Pipeline } from '@/shared/constants/enums/pipelines'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { CustomerMatchField } from '@/shared/entities/customers/dal/server/customer-search-rank-sql'

import { and, desc, sql } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { customerSearchSql, PHRASE_SIMILARITY_THRESHOLD, WORD_SIMILARITY_THRESHOLD } from '@/shared/entities/customers/dal/server/customer-search-rank-sql'
import { parseCustomerSearch } from '@/shared/entities/customers/lib/customer-search-tokens'
import { derivedPipelineSql } from '@/shared/entities/customers/lib/derived-pipeline-sql'
import { canSeeUngatedPhone, gatedPhoneSql } from '@/shared/entities/customers/lib/phone-gating-sql'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import 'server-only'

export interface RankedCustomer {
  id: string
  name: string
  city: string
  address: string | null
  zip: string
  email: string | null
  /** Gated: null when the caller may not see it. */
  phone: string | null
  pipeline: Pipeline
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
      // `<%` reads its threshold from this setting; `true` scopes it to this transaction.
      await tx.execute(sql`SELECT set_config('pg_trgm.word_similarity_threshold', ${String(WORD_SIMILARITY_THRESHOLD)}, true)`)
      await tx.execute(sql`SELECT set_config('pg_trgm.similarity_threshold', ${String(PHRASE_SIMILARITY_THRESHOLD)}, true)`)
      return tx
        .select({
          id: customers.id,
          name: customers.name,
          city: customers.city,
          address: customers.address,
          zip: customers.zip,
          email: customers.email,
          phone: gatedPhone,
          pipeline: derivedPipelineSql(),
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
