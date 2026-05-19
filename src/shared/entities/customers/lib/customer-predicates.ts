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
 * Senior check from raw numeric age (CSLB 5-day rescission threshold).
 * Distinct from `isSenior(ageGroup)` — see ../DOCS.md#senior-age-thresholds-two-paths
 */
export function isSeniorByAge(age: number | null | undefined): boolean {
  if (age == null) {
    return false
  }
  return age >= 65
}
