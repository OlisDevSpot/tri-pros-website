// src/shared/entities/customers/dal/server/customer-search-rank-sql.ts
import type { SQL } from 'drizzle-orm'

import type { CustomerSearchQuery, CustomerSearchToken } from '@/shared/entities/customers/lib/customer-search-tokens'

import { sql } from 'drizzle-orm'

import { customers } from '@/shared/db/schema/customers'
import 'server-only'

export type CustomerMatchField = 'name' | 'phone' | 'address' | 'email'

/** Below this `word_similarity` a text token is not a hit. */
export const WORD_SIMILARITY_THRESHOLD = 0.4

/** Fixed score for a name word that is a letter-swapped spelling of the token. */
export const TRANSPOSED_NAME_SCORE = 0.8

// Must stay identical to `customers_address_trgm_idx` in the schema, or the planner skips the index.
export const customerAddressDocSql = sql`(coalesce(${customers.address}, '') || ' ' || ${customers.city})`

interface TokenSql {
  match: SQL
  score: SQL
  nameScore: SQL
  addressScore: SQL
  phoneHit: SQL
  emailHit: SQL
}

export interface CustomerSearchSql {
  where: SQL
  score: SQL<number>
  matchedOn: SQL<CustomerMatchField>
}

const ZERO = sql`0`
const FALSE = sql`false`

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, m => `\\${m}`)
}

function textTokenSql(value: string): TokenSql {
  const escaped = escapeLike(value)
  const trigramNameScore = sql`word_similarity(${value}, ${customers.name})`
  const addressScore = sql`word_similarity(${value}, ${customerAddressDocSql})`
  const namePrefix = sql`(${customers.name} ILIKE ${`${escaped}%`} OR ${customers.name} ILIKE ${`% ${escaped}%`})`
  // Trigrams can't see two swapped letters in a short word; dropped, doubled or substituted letters are already covered by word_similarity.
  const anagramHit = value.length >= 3 ? nameWordAnagramSql(value) : FALSE
  const nameScore = sql`greatest(${trigramNameScore}, CASE WHEN ${anagramHit} THEN ${sql.raw(String(TRANSPOSED_NAME_SCORE))} ELSE 0 END)`
  const trigramMatch = value.length < 3
    ? namePrefix
    // Trigrams of a one- or two-letter token match almost anything; short tokens count only as a name-word prefix.
    : sql`(${value} <% ${customers.name} OR ${value} <% ${customerAddressDocSql})`
  return {
    match: value.length < 3 ? trigramMatch : sql`(${trigramMatch} OR ${anagramHit})`,
    score: sql`(greatest(${nameScore}, 0.9 * ${addressScore}) + CASE WHEN ${namePrefix} THEN 0.1 ELSE 0 END)`,
    nameScore,
    addressScore,
    phoneHit: FALSE,
    emailHit: FALSE,
  }
}

function nameWordAnagramSql(value: string): SQL {
  const sorted = [...value].sort().join('')
  return sql`EXISTS (
    SELECT 1 FROM regexp_split_to_table(lower(${customers.name}), '\\s+') AS w
    WHERE length(w) = ${value.length}
      AND (SELECT string_agg(c, '' ORDER BY c) FROM regexp_split_to_table(w, '') AS c) = ${sorted}
  )`
}

function numberTokenSql(value: string, gatedPhone: SQL): TokenSql {
  const houseNumber = sql`(${customers.address} ILIKE ${`${value} %`})`
  const zip = sql`(${customers.zip} LIKE ${`${value}%`})`
  const inAddress = sql`(${customers.address} ILIKE ${`%${value}%`})`
  // Phones are stored as bare digits, so a digit run matches the gated value directly.
  const phone = sql`(coalesce(${gatedPhone}, '') LIKE ${`%${value}%`})`
  const onAddress = sql`(${zip} OR ${inAddress})`
  return {
    match: sql`(${onAddress} OR ${phone})`,
    score: sql`CASE WHEN ${houseNumber} THEN 0.85 WHEN ${zip} THEN 0.8 WHEN ${phone} THEN 0.75 WHEN ${inAddress} THEN 0.6 ELSE 0 END`,
    nameScore: ZERO,
    addressScore: sql`CASE WHEN ${onAddress} THEN 1 ELSE 0 END`,
    phoneHit: sql`(${phone} AND NOT ${onAddress})`,
    emailHit: FALSE,
  }
}

function emailTokenSql(value: string): TokenSql {
  const hit = sql`(${customers.email} ILIKE ${`${escapeLike(value)}%`})`
  return { match: hit, score: sql`CASE WHEN ${hit} THEN 1 ELSE 0 END`, nameScore: ZERO, addressScore: ZERO, phoneHit: FALSE, emailHit: hit }
}

function tokenSql(token: CustomerSearchToken, gatedPhone: SQL): TokenSql {
  switch (token.kind) {
    case 'text': return textTokenSql(token.value)
    case 'number': return numberTokenSql(token.value, gatedPhone)
    case 'email': return emailTokenSql(token.value)
  }
}

/** `null` when the term has nothing to match on. `gatedPhone` must be the expression the caller renders. */
export function customerSearchSql(query: CustomerSearchQuery, gatedPhone: SQL): CustomerSearchSql | null {
  if (query.phoneDigits) {
    return {
      where: sql`(coalesce(${gatedPhone}, '') LIKE ${`%${query.phoneDigits}%`})`,
      score: sql<number>`1::float8`.mapWith(Number),
      matchedOn: sql<CustomerMatchField>`'phone'`,
    }
  }
  if (query.tokens.length === 0) {
    return null
  }
  const parts = query.tokens.map(token => tokenSql(token, gatedPhone))
  const joined = (key: keyof TokenSql, op: 'AND' | 'OR' | '+') => sql.join(parts.map(part => part[key]), sql.raw(` ${op} `))
  return {
    where: sql`(${joined('match', 'AND')})`,
    score: sql<number>`((${joined('score', '+')}) / ${sql.raw(String(parts.length))})::float8`.mapWith(Number),
    matchedOn: sql<CustomerMatchField>`CASE
      WHEN ${joined('phoneHit', 'OR')} THEN 'phone'
      WHEN ${joined('emailHit', 'OR')} THEN 'email'
      WHEN (${joined('nameScore', '+')}) >= (${joined('addressScore', '+')}) THEN 'name'
      ELSE 'address' END`,
  }
}
