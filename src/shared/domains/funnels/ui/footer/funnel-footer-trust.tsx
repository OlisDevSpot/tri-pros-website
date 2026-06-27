import { Check } from 'lucide-react'
import { awards, companyInfo, licenses, stats } from '@/shared/constants/company'

/**
 * Page-bottom legitimacy markers for the funnel footer. A distinct surface from
 * the hero `TrustBar`; both read the same company constants (no duplicated
 * literals). Company data only — never hardcode credentials.
 */
export function FunnelFooterTrust() {
  const bbb = stats.find(s => s.label === 'BBB Rating')
  const markers = [
    `CA Lic. #${licenses[0]?.licenseNumber ?? ''}`,
    'Licensed, Bonded & Insured',
    bbb ? `${bbb.number} BBB Rating` : null,
    `${companyInfo.numProjects}+ Projects`,
    `${companyInfo.combinedYearsExperience}+ Yrs Experience`,
    `${Math.round(companyInfo.clientSatisfaction * 100)}% Satisfaction`,
    awards[0]?.label ?? null,
  ].filter((m): m is string => Boolean(m))

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {markers.map(m => (
        <li key={m} className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
          <Check className="size-3.5 shrink-0" aria-hidden="true" />
          {m}
        </li>
      ))}
    </ul>
  )
}
