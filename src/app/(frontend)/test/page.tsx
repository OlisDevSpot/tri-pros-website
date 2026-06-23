import type { FunnelContext } from '@/shared/domains/funnels/types'

import Image from 'next/image'

import { Decor } from '@/shared/components/decor/decor'
import { CredentialStrip } from '@/shared/components/trust/credential-strip'
import { EMPTY_UTM } from '@/shared/domains/funnels/constants/utm'
import { Block } from '@/shared/domains/funnels/ui/block/block'
import { CalloutBlock } from '@/shared/domains/funnels/ui/blocks/callout-block'
import { FaqBlock } from '@/shared/domains/funnels/ui/blocks/faq-block'

// FunnelTheme is `{ accent: string }`; FunnelUtm is the EMPTY_UTM shape.
const DEMO_CTX: FunnelContext = { slug: 'kitchens', offer: 'kitchen remodel', theme: { accent: '#03AFED' }, utm: EMPTY_UTM }

export default function TestPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-16">
      <Block media="right" surface="card" align="left">
        <Block.Content>
          <Block.Eyebrow>Financing · in writing</Block.Eyebrow>
          <Block.Headline>A Showcase kitchen, without draining your savings.</Block.Headline>
          <Block.Body>Fixed, low monthly payments. We walk you through the options you qualify for during your consultation — no obligation, clear written numbers.</Block.Body>
          <Block.Trust><CredentialStrip /></Block.Trust>
          <Block.Actions>
            <button type="button" className="bg-foreground text-card inline-flex items-center gap-2.5 rounded-[3px] px-6 py-3.5 text-[14.5px] font-bold">See what you qualify for</button>
          </Block.Actions>
        </Block.Content>
        <Block.Media side="right" overlay={<Decor shape="arc" placement="cover" />}>
          <Image src="/portfolio-photos/modern-kitchen-1.jpeg" alt="" fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
        </Block.Media>
      </Block>
      <CalloutBlock
        ctx={DEMO_CTX}
        content={{
          headline: 'A Showcase kitchen, without draining your savings.',
          body: 'Fixed, low monthly payments. We walk you through the options you qualify for during your consultation — no obligation, clear written numbers.',
        }}
      />
      <FaqBlock
        ctx={DEMO_CTX}
        content={{
          title: 'Common questions',
          items: [
            { q: 'How long does it take?', a: 'A typical Showcase kitchen runs about 3–10 weeks of active construction after design and permits.' },
            { q: 'Is financing available?', a: 'Yes — fixed, low monthly payments so you can start now and pay over time.' },
          ],
        }}
      />
    </main>
  )
}
