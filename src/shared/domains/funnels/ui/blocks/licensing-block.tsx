import type { FunnelContext, LicensingBlockContent } from '@/shared/domains/funnels/types'

import { BadgeCheck, ShieldCheck } from 'lucide-react'

import { licenses } from '@/shared/constants/company/licenses'

export function LicensingBlock({ content }: { content: LicensingBlockContent, ctx: FunnelContext }) {
  const primary = licenses[0]
  return (
    <section className="bg-muted/30 flex flex-col items-center gap-3 rounded-2xl px-6 py-10 text-center">
      <h2 className="text-lg font-semibold">{content.title ?? 'Licensed, Bonded & Insured'}</h2>
      <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
        <span className="flex items-center gap-1.5">
          <BadgeCheck className="text-muted-foreground size-4" />
          {' '}
          {primary.type}
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="text-muted-foreground size-4" />
          {' '}
          Fully insured
        </span>
        <span>
          CSLB #
          {primary.licenseNumber}
        </span>
      </div>
    </section>
  )
}
