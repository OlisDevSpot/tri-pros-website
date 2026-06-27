'use client'

/*
 * SCRATCH EVAL — Magic UI showcase (not production).
 *
 * A real marketing composition, not a clinical lab: a composed hero (4 Magic UI
 * components working together) followed by per-component VARIANT galleries, all on
 * the Blueprint Authority theme (warm concrete + brand blue #03AFED only).
 * Designed through the ui-ux-pro-max lens + docs/design-system/DESIGN.md:
 *   · Syne display weight/size extremes vs Nunito body  · brand blue is the only accent
 *   · hairline borders before shadows  · radius scale (chip/panel/pill)  · blueprint decor
 *   · one primary CTA per composition  · staggered, reduced-motion-safe reveals
 *
 * Registry: @magicui → https://magicui.design/r/{name}.json
 */

import { ArrowRight, Bath, ChefHat, Home, Quote, Sparkles, Star, Warehouse } from 'lucide-react'
import Link from 'next/link'
import { Decor } from '@/shared/components/decor/decor'
import { AnimatedShinyText } from '@/shared/components/ui/animated-shiny-text'
import { AuroraText } from '@/shared/components/ui/aurora-text'
import { BentoCard, BentoGrid } from '@/shared/components/ui/bento-grid'
import { BlurFade } from '@/shared/components/ui/blur-fade'
import { BorderBeam } from '@/shared/components/ui/border-beam'
import { Marquee } from '@/shared/components/ui/marquee'
import { NumberTicker } from '@/shared/components/ui/number-ticker'
import { ShimmerButton } from '@/shared/components/ui/shimmer-button'
import { ROOTS } from '@/shared/config/roots'
import { cn } from '@/shared/lib/utils'

const BRAND = '#03afed'
const BRAND_BLUES = ['#03afed', '#0784b3', '#5cc6f2']
const CITIES = ['Encino', 'Pasadena', 'Glendale', 'Burbank', 'Sherman Oaks', 'Tarzana', 'Studio City', 'Northridge', 'Calabasas', 'Woodland Hills']
const REVIEWS = [
  { name: 'The Ramirez Family', city: 'Encino', quote: 'They gutted our kitchen and finished two days early. Spotless.' },
  { name: 'D. Chen', city: 'Pasadena', quote: 'Honest pricing, zero surprises. The crew treated our home like theirs.' },
  { name: 'M. Okafor', city: 'Glendale', quote: 'Our ADU is gorgeous and permitted without a single headache.' },
  { name: 'S. Williams', city: 'Sherman Oaks', quote: 'Best contractor experience we have ever had — and we have done three remodels.' },
]

const FONT_DISPLAY = { fontFamily: 'var(--font-sans)' } as const
const BLUEPRINT_BG = {
  backgroundImage:
    'linear-gradient(color-mix(in srgb, var(--primary) 8%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--primary) 8%, transparent) 1px, transparent 1px)',
  backgroundSize: '34px 34px',
  maskImage: 'radial-gradient(120% 90% at 75% 0%, #000 35%, transparent 80%)',
} as const

// ── Section header ──────────────────────────────────────────────────────────────
function SectionHead({ index, title, blurb }: { index: number, title: string, blurb: string }) {
  return (
    <div className="mb-7 flex items-start gap-4">
      <span className="text-2xl font-black tabular-nums text-primary/25" style={FONT_DISPLAY}>
        {String(index).padStart(2, '0')}
      </span>
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight" style={FONT_DISPLAY}>{title}</h2>
        <p className="mt-1 max-w-xl text-sm" style={{ color: 'var(--body-text)' }}>{blurb}</p>
      </div>
    </div>
  )
}

// ── Variant tile: a framed surface + a small caption ─────────────────────────────
function Variant({ label, children, className, padded = true }: { label: string, children: React.ReactNode, className?: string, padded?: boolean }) {
  return (
    <figure className={cn('group flex flex-col overflow-hidden rounded-[--radius] border border-border bg-card', className)}>
      <div className={cn('flex flex-1 items-center justify-center', padded && 'p-6')}>
        {children}
      </div>
      <figcaption className="border-t border-border px-4 py-2 text-xs font-semibold" style={{ color: 'var(--accent-ink)' }}>
        {label}
      </figcaption>
    </figure>
  )
}

export default function MagicEvalPage() {
  return (
    <main className="theme-marketing min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.22em] text-primary" style={FONT_DISPLAY}>
              Magic UI · Showcase
            </p>
            <h1 className="text-lg font-extrabold tracking-tight" style={FONT_DISPLAY}>Component variants</h1>
          </div>
          <Link
            href={ROOTS.landing.services()}
            className="rounded-full border border-border bg-card px-4 py-1.5 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            View site →
          </Link>
        </div>
      </header>

      {/* ── HERO: a real composition (shiny eyebrow + aurora headline + shimmer CTA + tickers) ── */}
      <section className="relative isolate overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0" style={BLUEPRINT_BG} />
        <Decor shape="arc" placement="corner" />
        <div className="relative z-10 mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="inline-flex items-center rounded-full border border-border bg-card/70 px-4 py-1.5 backdrop-blur-sm">
            <AnimatedShinyText className="inline-flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              Now booking Summer 2026 remodels
            </AnimatedShinyText>
          </div>

          <h2 className="mt-6 max-w-3xl text-5xl font-black leading-[0.95] tracking-tight md:text-7xl" style={FONT_DISPLAY}>
            Your home,
            {' '}
            <AuroraText colors={BRAND_BLUES} speed={1.2}>remodeled right</AuroraText>
            {' '}
            the first time.
          </h2>

          <p className="mt-6 max-w-xl text-lg leading-relaxed" style={{ color: 'var(--body-text)' }}>
            Family-led Southern California remodeling — kitchens, baths, ADUs and additions,
            managed end to end by one crew that treats your home like their own.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <ShimmerButton background={BRAND} shimmerColor="#ffffff" borderRadius="9999px" className="px-7 py-3 font-semibold shadow-[var(--shadow-md)]">
              <span className="flex items-center gap-2 text-base text-white" style={FONT_DISPLAY}>
                Get your free estimate
                <ArrowRight className="h-4 w-4" />
              </span>
            </ShimmerButton>
            <Link href={ROOTS.landing.portfolioProjects()} className="text-sm font-bold underline-offset-4 hover:underline" style={{ color: 'var(--accent-ink)' }}>
              See recent projects
            </Link>
          </div>

          {/* Stat strip — Number Ticker with hairline dividers */}
          <dl className="mt-14 flex flex-wrap gap-x-10 gap-y-6 border-t border-border pt-8">
            {[
              { value: 520, suffix: '+', label: 'Projects completed' },
              { value: 40, suffix: '+', label: 'Years combined experience' },
              { value: 8, suffix: '', label: 'SoCal cities served' },
              { value: 98, suffix: '%', label: 'Would refer us' },
            ].map(s => (
              <div key={s.label} className="border-l border-border pl-5 first:border-l-0 first:pl-0">
                <dd className="flex items-baseline text-4xl font-black tracking-tight text-primary" style={FONT_DISPLAY}>
                  <NumberTicker value={s.value} />
                  {s.suffix}
                </dd>
                <dt className="mt-1 text-sm" style={{ color: 'var(--body-text)' }}>{s.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-24 px-6 py-20">
        {/* 01 — Aurora Text headlines */}
        <section>
          <SectionHead index={1} title="Aurora headlines" blurb="Animated gradient on one key word. Constrained to the brand-blue family so it still reads as ours. Vary scale + speed by surface." />
          <div className="grid gap-4 md:grid-cols-3">
            <Variant label="Hero scale · speed 1.2" className="md:col-span-2">
              <p className="text-3xl font-black leading-tight tracking-tight md:text-4xl" style={FONT_DISPLAY}>
                Built
                {' '}
                <AuroraText colors={BRAND_BLUES} speed={1.2}>right</AuroraText>
                , built once.
              </p>
            </Variant>
            <Variant label="Subtle · 2 close blues">
              <p className="text-2xl font-black tracking-tight" style={FONT_DISPLAY}>
                <AuroraText colors={['#0784b3', '#03afed']} speed={0.7}>Craftsmanship</AuroraText>
              </p>
            </Variant>
            <Variant label="Eyebrow scale">
              <p className="text-sm font-bold uppercase tracking-[0.2em]" style={FONT_DISPLAY}>
                <AuroraText colors={BRAND_BLUES}>Since 2021</AuroraText>
              </p>
            </Variant>
            <Variant label="Section title" className="md:col-span-2">
              <p className="text-3xl font-extrabold tracking-tight" style={FONT_DISPLAY}>
                Kitchens worth
                {' '}
                <AuroraText colors={BRAND_BLUES} speed={1.5}>showing off</AuroraText>
                .
              </p>
            </Variant>
          </div>
        </section>

        {/* 02 — Number Ticker stat displays */}
        <section>
          <SectionHead index={2} title="Stat displays" blurb="Count-up numbers for credibility. Same primitive, three densities: hero trio, single hero metric, and compact inline strip." />
          <div className="grid gap-4 md:grid-cols-3">
            <Variant label="Stat cards · icon + label">
              <div className="grid w-full grid-cols-2 gap-3">
                {[{ icon: Star, v: 49, dp: 1, suffix: '', l: 'Avg rating', div: 10 }, { icon: Home, v: 520, dp: 0, suffix: '+', l: 'Projects', div: 1 }].map(s => (
                  <div key={s.l} className="rounded-[--radius] bg-secondary p-4">
                    <s.icon className="h-5 w-5 text-primary" />
                    <div className="mt-2 flex items-baseline text-2xl font-black text-primary" style={FONT_DISPLAY}>
                      <NumberTicker value={s.v / s.div} decimalPlaces={s.dp} />
                      {s.suffix}
                    </div>
                    <p className="text-xs" style={{ color: 'var(--body-text)' }}>{s.l}</p>
                  </div>
                ))}
              </div>
            </Variant>
            <Variant label="Single hero metric">
              <div className="text-center">
                <div className="flex items-baseline justify-center text-6xl font-black tracking-tight text-primary" style={FONT_DISPLAY}>
                  $
                  <NumberTicker value={48} />
                  M
                </div>
                <p className="mt-1 text-sm" style={{ color: 'var(--body-text)' }}>delivered in remodels</p>
              </div>
            </Variant>
            <Variant label="Compact inline strip">
              <p className="text-center text-sm font-semibold" style={{ color: 'var(--cred-ink)' }}>
                <span className="text-primary">
                  <NumberTicker value={520} />
                  +
                </span>
                {' '}
                projects
                {' · '}
                <span className="text-primary"><NumberTicker value={8} /></span>
                {' '}
                cities
                {' · '}
                <span className="text-primary">
                  <NumberTicker value={98} />
                  %
                </span>
                {' '}
                referral rate
              </p>
            </Variant>
          </div>
        </section>

        {/* 03 — Shimmer Button CTAs */}
        <section>
          <SectionHead index={3} title="Primary CTAs" blurb="One high-energy CTA per view. Vary radius + surface — pill on light, panel on a dark plate. Never use more than one per screen." />
          <div className="grid gap-4 md:grid-cols-3">
            <Variant label="Pill · on light">
              <ShimmerButton background={BRAND} shimmerColor="#ffffff" className="px-6 py-3 font-semibold">
                <span className="flex items-center gap-2 text-white" style={FONT_DISPLAY}>
                  Free estimate
                  <ArrowRight className="h-4 w-4" />
                </span>
              </ShimmerButton>
            </Variant>
            <Variant label="Panel radius (6px)">
              <ShimmerButton background={BRAND} shimmerColor="#ffffff" borderRadius="6px" className="px-6 py-3 font-semibold">
                <span className="text-white" style={FONT_DISPLAY}>Book a consult</span>
              </ShimmerButton>
            </Variant>
            <Variant label="On a dark plate" padded={false}>
              <div className="flex w-full items-center justify-center p-6" style={{ background: 'var(--foreground)' }}>
                <ShimmerButton background={BRAND} shimmerColor="#ffffff" className="px-6 py-3 font-semibold">
                  <span className="flex items-center gap-2 text-white" style={FONT_DISPLAY}>
                    Start your project
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </ShimmerButton>
              </div>
            </Variant>
          </div>
        </section>

        {/* 04 — Border Beam featured cards */}
        <section>
          <SectionHead index={4} title="Featured cards" blurb="A traveling light marks one 'hero' card. Tune size/speed/color: confident for 'most popular', slow + soft for testimonials, fast for urgency." />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative overflow-hidden rounded-[--radius] border border-border bg-card p-6 shadow-[var(--shadow-md)]">
              <BorderBeam size={130} duration={8} colorFrom="#03afed" colorTo="#5cc6f2" />
              <p className="text-xs font-bold uppercase tracking-widest text-primary" style={FONT_DISPLAY}>Most popular</p>
              <h3 className="mt-2 text-xl font-extrabold" style={FONT_DISPLAY}>Full Kitchen Remodel</h3>
              <p className="mt-2 text-sm" style={{ color: 'var(--body-text)' }}>Cabinets, counters, flooring and finishes — one crew, end to end.</p>
              <p className="mt-4 text-xs font-semibold" style={{ color: 'var(--accent-ink)' }}>size 130 · 8s · confident</p>
            </div>
            <div className="relative overflow-hidden rounded-[--radius] border border-border bg-card p-6">
              <BorderBeam size={80} duration={13} colorFrom="#5cc6f2" colorTo="#03afed" />
              <Quote className="h-6 w-6 text-primary/40" />
              <p className="mt-3 text-sm font-medium leading-relaxed">“Finished two days early and spotless. We could not be happier.”</p>
              <p className="mt-3 text-xs font-semibold" style={{ color: 'var(--body-text)' }}>— The Ramirez Family, Encino</p>
              <p className="mt-4 text-xs font-semibold" style={{ color: 'var(--accent-ink)' }}>size 80 · 13s · soft</p>
            </div>
            <div className="relative overflow-hidden rounded-[--radius] border border-border bg-card p-6">
              <BorderBeam size={110} duration={5} colorFrom="#03afed" colorTo="#03afed" />
              <p className="text-xs font-bold uppercase tracking-widest text-primary" style={FONT_DISPLAY}>Limited</p>
              <h3 className="mt-2 text-xl font-extrabold" style={FONT_DISPLAY}>3 Summer slots left</h3>
              <p className="mt-2 text-sm" style={{ color: 'var(--body-text)' }}>Lock in 2026 pricing before the season fills up.</p>
              <p className="mt-4 text-xs font-semibold" style={{ color: 'var(--accent-ink)' }}>size 110 · 5s · urgent</p>
            </div>
          </div>
        </section>

        {/* 05 — Marquee trust strips */}
        <section>
          <SectionHead index={5} title="Trust strips" blurb="Infinite scrollers for proof. Chips for coverage, cards for reviews, a reverse second row for a denser wall. Pauses on hover; fades at the edges." />
          <div className="space-y-4">
            <Variant label="City chips · single row" padded={false}>
              <div className="relative w-full overflow-hidden py-5">
                <Marquee pauseOnHover className="[--duration:30s]">
                  {CITIES.map(c => (
                    <span key={c} className="mx-2 rounded-full border border-border bg-secondary px-4 py-1.5 text-sm font-semibold">{c}</span>
                  ))}
                </Marquee>
                <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-card" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-card" />
              </div>
            </Variant>

            <Variant label="Review cards" padded={false}>
              <div className="relative w-full overflow-hidden py-5">
                <Marquee pauseOnHover className="[--duration:36s]">
                  {REVIEWS.map(r => (
                    <div key={r.name} className="mx-2 w-72 rounded-[--radius] border border-border bg-secondary p-4">
                      <div className="flex gap-0.5 text-primary">
                        {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}
                      </div>
                      <p className="mt-2 text-sm leading-snug">
                        “
                        {r.quote}
                        ”
                      </p>
                      <p className="mt-2 text-xs font-semibold" style={{ color: 'var(--body-text)' }}>
                        {r.name}
                        {' '}
                        ·
                        {' '}
                        {r.city}
                      </p>
                    </div>
                  ))}
                </Marquee>
                <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-card" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-card" />
              </div>
            </Variant>

            <Variant label="Dual row · reverse (logo-wall density)" padded={false}>
              <div className="relative w-full overflow-hidden py-5">
                <Marquee pauseOnHover className="[--duration:28s]">
                  {CITIES.slice(0, 6).map(c => (
                    <span key={c} className="mx-2 rounded-[--radius-chip] border border-border bg-secondary px-4 py-1.5 text-sm font-semibold">{c}</span>
                  ))}
                </Marquee>
                <Marquee reverse pauseOnHover className="mt-2 [--duration:28s]">
                  {CITIES.slice(4).map(c => (
                    <span key={c} className="mx-2 rounded-[--radius-chip] border border-border bg-secondary px-4 py-1.5 text-sm font-semibold">{c}</span>
                  ))}
                </Marquee>
                <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-card" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-card" />
              </div>
            </Variant>
          </div>
        </section>

        {/* 06 — Bento Grid services */}
        <section>
          <SectionHead index={6} title="Services bento" blurb="An asymmetric grid for the four pillars. Re-themed to warm card + hairline (the default ships dark-card styling). Hover lifts the CTA + scales the icon." />
          <BentoGrid className="auto-rows-[15rem]">
            {[
              { Icon: ChefHat, name: 'Kitchen Remodels', description: 'Gut-to-finish kitchens.', cls: 'lg:col-span-2' },
              { Icon: Bath, name: 'Bathroom Remodels', description: 'Spa-grade master baths.', cls: 'lg:col-span-1' },
              { Icon: Home, name: 'Additions & ADUs', description: 'Add the right square footage.', cls: 'lg:col-span-1' },
              { Icon: Warehouse, name: 'Garage Conversions', description: 'New living space from the garage.', cls: 'lg:col-span-2' },
            ].map(item => (
              <BentoCard
                key={item.name}
                name={item.name}
                description={item.description}
                Icon={item.Icon}
                href={ROOTS.landing.services()}
                cta="Explore"
                className={cn('col-span-3 border border-border !bg-card shadow-[var(--shadow-sm)]', item.cls)}
                background={<div className="absolute inset-0 opacity-50" style={BLUEPRINT_BG} />}
              />
            ))}
          </BentoGrid>
        </section>

        {/* 07 — Animated Shiny Text eyebrows */}
        <section>
          <SectionHead index={7} title="Eyebrows & hints" blurb="A subtle shimmer sweep for announcement pills and quiet hints. Great at small size; never on body copy." />
          <div className="grid gap-4 md:grid-cols-2">
            <Variant label="Announcement pill">
              <div className="inline-flex items-center rounded-full border border-border bg-secondary px-4 py-1.5">
                <AnimatedShinyText className="inline-flex items-center gap-1.5 text-sm font-semibold">
                  <Sparkles className="h-3.5 w-3.5" />
                  {' '}
                  Financing now available
                </AnimatedShinyText>
              </div>
            </Variant>
            <Variant label="Quiet inline hint">
              <AnimatedShinyText className="text-sm font-semibold">
                Trusted across the San Fernando &amp; San Gabriel valleys
              </AnimatedShinyText>
            </Variant>
          </div>
        </section>

        {/* 08 — Blur Fade reveals */}
        <section>
          <SectionHead index={8} title="Reveals" blurb="Entrance animation for a gallery or feature row — staggered, directional, reduced-motion-safe (animates on mount)." />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Demolition', dir: 'up' as const },
              { label: 'Framing', dir: 'left' as const },
              { label: 'Finishes', dir: 'right' as const },
              { label: 'Reveal', dir: 'up' as const },
            ].map((step, i) => (
              <BlurFade key={step.label} delay={0.12 * i} direction={step.dir} blur="8px">
                <div className="flex h-28 flex-col items-center justify-center rounded-[--radius] border border-border bg-card">
                  <span className="text-xs font-bold tabular-nums text-primary/50" style={FONT_DISPLAY}>
                    0
                    {i + 1}
                  </span>
                  <span className="mt-1 font-bold" style={FONT_DISPLAY}>{step.label}</span>
                </div>
              </BlurFade>
            ))}
          </div>
        </section>

        <footer className="border-t border-border pt-6 text-xs" style={{ color: 'var(--body-text)' }}>
          Magic UI · catalog: docs/design-system/shadcn-registries.md
        </footer>
      </div>
    </main>
  )
}
