import type { FunnelContext, LicensingBlockContent } from '@/shared/domains/funnels/types'

import { BadgeCheck, ShieldCheck } from 'lucide-react'

import { licenses } from '@/shared/constants/company/licenses'
import { Block } from '@/shared/domains/funnels/ui/block/block'

export function LicensingBlock({ content }: { content: LicensingBlockContent, ctx: FunnelContext }) {
  const primary = licenses[0]
  return (
    <Block surface="muted" align="center">
      <Block.Content>
        <Block.Headline>{content.title ?? 'Licensed, Bonded & Insured'}</Block.Headline>
        {/* Credentials are this block's centerpiece — kept as a centered freeform row
            (NOT Block.Trust, which forces left) so it honors align="center". */}
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
      </Block.Content>
    </Block>
  )
}
