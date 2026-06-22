import type { FunnelContext } from '@/shared/domains/funnels/types'
import { EMPTY_UTM } from '@/shared/domains/funnels/hooks/use-funnel-utm'
import { CalloutBlock } from '@/shared/domains/funnels/ui/blocks/callout-block'
import { FaqBlock } from '@/shared/domains/funnels/ui/blocks/faq-block'

// FunnelTheme is `{ accent: string }`; FunnelUtm is the EMPTY_UTM shape.
const DEMO_CTX: FunnelContext = { slug: 'kitchens', offer: 'kitchen remodel', theme: { accent: '#03AFED' }, utm: EMPTY_UTM }

export default function TestPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-5 py-16">
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
