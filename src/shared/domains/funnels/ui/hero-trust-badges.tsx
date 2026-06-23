import { Star } from 'lucide-react'
import { FaGoogle, FaYelp } from 'react-icons/fa'
import { socials, stats } from '@/shared/constants/company'

/**
 * Light-surface social-proof row for the funnel hero: Google rating, Yelp, BBB.
 *
 * Solid white pills (system `--border` hairline + `--shadow-sm`, `--foreground`
 * ink) so they read crisply on the hero's bright frosted card — the old
 * translucent-glass variant vanished on light. Lives in the hero so proof sits
 * directly above the CTA (proof → ask). The longer credential chips stay below
 * the hero (`TrustBar`).
 */
export function HeroTrustBadges({ rating = 4.9, count = 200 }: { rating?: number, count?: number }) {
  const googleHref = socials.find(s => s.name === 'google')?.href
  const yelpHref = socials.find(s => s.name === 'yelp')?.href
  const bbb = stats.find(s => s.label === 'BBB Rating')?.number ?? 'A+'
  const pill = 'inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-white px-3.5 py-1.5 shadow-sm'

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 @3xl:justify-start">
      <a
        href={googleHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Google reviews: ${rating.toFixed(1)} out of 5 from ${count} reviews (opens in a new tab)`}
        className={`${pill} transition-colors hover:border-(--accent-ink)`}
      >
        <FaGoogle className="text-foreground size-4" aria-hidden="true" />
        <span className="text-foreground text-sm font-semibold">Google</span>
        <span className="flex items-center gap-0.5" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} size={13} className="fill-amber-500 text-amber-500" />
          ))}
        </span>
        <span className="text-foreground text-sm font-semibold tabular-nums">{rating.toFixed(1)}</span>
      </a>
      <a
        href={yelpHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Yelp reviews: verified (opens in a new tab)"
        className={`${pill} transition-colors hover:border-(--accent-ink)`}
      >
        <FaYelp className="text-foreground size-4" aria-hidden="true" />
        <span className="text-foreground text-sm font-semibold">Yelp</span>
        <span className="text-muted-foreground text-sm">Verified</span>
      </a>
      <div className={pill}>
        <span className="text-foreground text-sm font-semibold">BBB</span>
        <span className="text-foreground text-sm font-semibold">{bbb}</span>
      </div>
    </div>
  )
}
