import { Check } from 'lucide-react'
import { FaGoogle, FaYelp } from 'react-icons/fa'
import { PlatformBadge } from '@/shared/components/reviews/platform-badge'
import { StarRating } from '@/shared/components/reviews/star-rating'
import { companyInfo, licenses, socials, stats } from '@/shared/constants/company'

/** Scannable legitimacy strip shown at the top of the funnel landing, under the hero. */
export function TrustBar({ rating = 4.9, count = 200 }: { rating?: number, count?: number }) {
  const googleHref = socials.find(s => s.name === 'google')?.href
  const yelpHref = socials.find(s => s.name === 'yelp')?.href
  const bbb = stats.find(s => s.label === 'BBB Rating')
  const chips = [
    'Licensed & Insured',
    `CSLB #${licenses[0]?.licenseNumber ?? ''}`,
    `${companyInfo.numProjects}+ Projects`,
    `${companyInfo.combinedYearsExperience}+ Yrs`,
    `${Math.round(companyInfo.clientSatisfaction * 100)}% Satisfaction`,
  ]
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <PlatformBadge platform="Google" href={googleHref} icon={<FaGoogle className="size-4" />}>
          <StarRating rating={rating} count={count} size={14} />
        </PlatformBadge>
        <PlatformBadge platform="Yelp" href={yelpHref} icon={<FaYelp className="size-4" />}>
          <span className="text-muted-foreground text-sm">Verified</span>
        </PlatformBadge>
        <PlatformBadge platform="BBB">
          <span className="text-foreground text-sm font-semibold">{bbb?.number ?? 'A+'}</span>
        </PlatformBadge>
      </div>
      <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {chips.map(chip => (
          <li key={chip} className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
            <Check className="text-primary size-3.5 shrink-0" aria-hidden="true" />
            {chip}
          </li>
        ))}
      </ul>
    </div>
  )
}
