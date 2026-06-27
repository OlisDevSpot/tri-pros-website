import type { FunnelContext } from '@/shared/domains/funnels/types'
import LogoOnLight from '@public/company/logo/logo-light-right.svg'
import Image from 'next/image'
import { companyInfo, socials } from '@/shared/constants/company'
import { funnelFooterBlurb } from '@/shared/domains/funnels/constants/footer-copy'
import { getTradeFacts } from '@/shared/domains/funnels/constants/trade-facts'
import { FunnelFooterLegal } from './funnel-footer-legal'
import { FunnelFooterTrust } from './funnel-footer-trust'

/**
 * Shared funnel footer — set up once, rendered on the landing, the PII submit
 * step, and the confirmation. Per-funnel only via `ctx` (trade name); everything
 * else is company-constant data, so kitchens and bathrooms render identically bar
 * the trade. Funnel is scoped-light under global `html.dark`, so the logo uses
 * the `logo-light-right` artwork directly (NOT the shared Logo component, which
 * switches on `dark:`). see funnel-hero.tsx for the same pattern.
 */
export function FunnelFooter({ ctx }: { ctx: FunnelContext }) {
  const trade = getTradeFacts(ctx.slug).name
  const year = new Date().getFullYear()

  return (
    <footer className="border-border/60 w-full border-t pt-10 pb-12">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5">
        <Image src={LogoOnLight} alt="Tri Pros Remodeling" width={180} height={48} className="h-11 w-auto" />
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
          {funnelFooterBlurb(trade)}
        </p>
        <FunnelFooterTrust />
        <FunnelFooterLegal />
        <div className="flex items-center gap-4">
          {socials.map(s => (
            <a
              key={s.name}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.name}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <s.Icon className="size-4" />
            </a>
          ))}
        </div>
        <p className="text-muted-foreground/70 text-xs">
          ©
          {' '}
          {year}
          {' '}
          {companyInfo.name}
          . All rights reserved.
        </p>
      </div>
    </footer>
  )
}
