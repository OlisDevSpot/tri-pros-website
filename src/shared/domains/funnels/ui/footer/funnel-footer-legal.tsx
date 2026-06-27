import { ROOTS } from '@/shared/config/roots'
import { FUNNEL_FOOTER_DISCLOSURE } from '@/shared/domains/funnels/constants/footer-copy'
import { mainSiteUrl } from '@/shared/lib/main-site-url'

/**
 * The conspicuous TCPA/legal disclosure + Privacy/Terms links. On the PII step
 * this block is the one the ~50%-visible-but-scrollable rule targets (the engine
 * lays the footer out so it peeks into the fold there). Links resolve to the apex
 * via `mainSiteUrl` — a relative path 404s on a funnel subdomain.
 */
export function FunnelFooterLegal() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground/80 text-[11px] leading-relaxed">
        {FUNNEL_FOOTER_DISCLOSURE}
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <a
          href={mainSiteUrl(ROOTS.landing.privacy())}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          Privacy Policy
        </a>
        <a
          href={mainSiteUrl(ROOTS.landing.terms())}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          Terms of Service
        </a>
      </div>
    </div>
  )
}
