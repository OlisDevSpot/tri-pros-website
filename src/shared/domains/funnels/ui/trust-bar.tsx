import { Check } from 'lucide-react'
import { companyInfo, licenses } from '@/shared/constants/company'

/**
 * Credential chip strip shown just under the hero, on the light marketing
 * theme. The punchy rating badges (Google/Yelp/BBB) now live INSIDE the hero
 * (`HeroTrustBadges`, above the CTA); this strip carries the longer-form
 * legitimacy signals so the dark hero stays clean.
 */
export function TrustBar() {
  const chips = [
    'Licensed & Insured',
    `CSLB #${licenses[0]?.licenseNumber ?? ''}`,
    `${companyInfo.numProjects}+ Projects`,
    `${companyInfo.combinedYearsExperience}+ Yrs`,
    `${Math.round(companyInfo.clientSatisfaction * 100)}% Satisfaction`,
  ]
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
      {chips.map(chip => (
        <li key={chip} className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
          <Check className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
          {chip}
        </li>
      ))}
    </ul>
  )
}
