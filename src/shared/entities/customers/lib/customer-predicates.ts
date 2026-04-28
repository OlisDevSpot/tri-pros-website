import type { CustomerAgeGroup } from '@/shared/constants/enums/customers'

const SENIOR_AGE_GROUPS: CustomerAgeGroup[] = ['65-75', '75-or-older']

/** Returns true if the customer is a senior, null if age group is not set. */
export function isSenior(ageGroup: CustomerAgeGroup | null | undefined): boolean | null {
  if (!ageGroup) {
    return null
  }
  return SENIOR_AGE_GROUPS.includes(ageGroup)
}

/**
 * Senior check from the raw numeric age the agent enters at draft time
 * (CSLB threshold for the 5-day cancellation window). Distinct from
 * `isSenior(ageGroup)` which works on the customer-profile age bucket
 * — the contract flow has the precise number, not a bucket.
 */
export function isSeniorByAge(age: number | null | undefined): boolean {
  if (age == null) {
    return false
  }
  return age >= 65
}
