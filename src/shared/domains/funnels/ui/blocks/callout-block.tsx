import type { CalloutBlockContent, FunnelContext } from '@/shared/domains/funnels/types'
import { ArrowRight } from 'lucide-react'
import { Decor } from '@/shared/components/decor/decor'
import { CredentialStrip } from '@/shared/components/trust/credential-strip'

/**
 * "Blueprint Authority" callout — warm-concrete panel + brand-blue blueprint
 * atmosphere (top-right), credential trust row, single accent CTA. Consumes the
 * marketing theme tokens; must render inside a `.theme-marketing` scope.
 * Design: docs/superpowers/specs/2026-06-22-anti-slop-design-system-design.md
 */
export function CalloutBlock({ content }: { content: CalloutBlockContent, ctx: FunnelContext }) {
  return (
    <section className="bg-background relative w-full overflow-hidden py-10">
      <div className="bg-card relative isolate w-full overflow-hidden rounded-md px-9 py-9" style={{ boxShadow: 'var(--shadow-card)' }}>
        <Decor shape="arc" />

        <p className="font-sans text-[11.5px] font-bold tracking-[0.2em] uppercase" style={{ color: 'var(--accent-ink)' }}>
          {content.eyebrow ?? 'Financing · in writing'}
        </p>
        <h2 className="text-foreground font-sans mt-3 text-[21px] leading-[1.2] font-bold tracking-[-0.01em]">
          {content.headline}
        </h2>
        <p className="mt-2.5 max-w-[48ch] text-[14.5px]" style={{ color: 'var(--body-text)' }}>
          {content.body}
        </p>

        <CredentialStrip className="mt-6" />

        <button type="button" className="bg-foreground text-card font-sans mt-6 inline-flex items-center gap-2.5 rounded-[3px] px-6 py-3.5 text-[14.5px] font-bold">
          {content.ctaLabel ?? 'See what you qualify for'}
          <ArrowRight className="size-4" style={{ color: 'var(--primary)' }} />
        </button>
      </div>
    </section>
  )
}
