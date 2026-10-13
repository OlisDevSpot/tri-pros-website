// LAZY: customers is still a plain entity; this helper moves to modules/customers/core/dal/server when customers is promoted to a module.
import type { SQL } from 'drizzle-orm'
import type { AppAbility } from '@/shared/domains/permissions/types'

import { ilike, or } from 'drizzle-orm'

import { buildSearchWhere } from '@/shared/dal/server/lib/query/search'
import { customers } from '@/shared/db/schema/customers'
import { canSeeUngatedPhone, gatedPhoneSql } from '@/shared/entities/customers/lib/phone-gating-sql'
import { toPhoneSearchDigits } from '@/shared/lib/phone'
import 'server-only'

/**
 * The one answer to "which customers match this term": name and email by text, phone by digits.
 * The phone side matches the gated expression the row renders, so a caller can only find a
 * number it can already see; passing the raw column here would be a leak.
 */
export function customerSearchWhere(search: string | undefined, ability: AppAbility): SQL | undefined {
  const digits = search ? toPhoneSearchDigits(search) : null
  return or(
    buildSearchWhere(search, [customers.name, customers.email]),
    digits ? ilike(gatedPhoneSql(canSeeUngatedPhone(ability)), `%${digits}%`) : undefined,
  )
}
