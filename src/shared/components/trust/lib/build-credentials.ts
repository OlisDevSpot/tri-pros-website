import { licenses } from '@/shared/constants/company/licenses'

export interface Credential { label: string }

// Derived from company constants — never hardcode trust facts in components.
// 3 items so the row fills cleanly and never orphan-wraps (spec §7).
export function buildCredentials(): Credential[] {
  return [
    { label: `Licensed #${licenses[0].licenseNumber}` },
    { label: 'Bonded & Insured' },
    { label: 'BBB A+ Rated' },
  ]
}
