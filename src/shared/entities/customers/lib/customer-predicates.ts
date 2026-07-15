import type { CustomerAgeGroup } from '@/shared/constants/enums/customers'
import type { CustomerWithProfile } from '@/shared/entities/customers/dal/server/queries'

import { CUSTOMER_PROFILE_COLUMN_KEYS } from '@/shared/entities/customers/schemas'

const SENIOR_AGE_GROUPS: CustomerAgeGroup[] = ['65-75', '75-or-older']

/** Returns true if the customer is a senior, null if age group is not set. */
export function isSenior(ageGroup: CustomerAgeGroup | null | undefined): boolean | null {
  if (!ageGroup) {
    return null
  }
  return SENIOR_AGE_GROUPS.includes(ageGroup)
}

/**
 * Senior check from raw numeric age (CSLB 5-day rescission threshold).
 * Distinct from `isSenior(ageGroup)` — see ../DOCS.md#senior-age-thresholds-two-paths
 */
export function isSeniorByAge(age: number | null | undefined): boolean {
  if (age == null) {
    return false
  }
  return age >= 65
}

/**
 * True if any customer-profile column (sales-psychology bucket, Addendum B
 * `customer_profiles` child table) has been filled — preserves the
 * pre-Wave-1 "does customerProfileJSON have data?" gate now that the blob is
 * a joined child row.
 */
export function hasCustomerProfileData(
  customer: Pick<CustomerWithProfile, (typeof CUSTOMER_PROFILE_COLUMN_KEYS)[number]> | null | undefined,
): boolean {
  if (!customer) {
    return false
  }
  return CUSTOMER_PROFILE_COLUMN_KEYS.some(k => customer[k] != null)
}
