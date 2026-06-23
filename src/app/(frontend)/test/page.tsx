'use client'

import LogoColor from '@public/company/logo/logo-light-right.svg'
import { ArrowDown, ArrowRight, Check, Star } from 'lucide-react'
import Image from 'next/image'
import { OPTION_ICONS } from '@/shared/domains/funnels/constants/option-assets'
import { FunnelCta } from '@/shared/domains/funnels/ui/funnel-cta'
import { cn } from '@/shared/lib/utils'

/*
 * PREVIEW SCRATCH — Q1 "dark moment" study (hero already shipped). Throwaway page.
 *
 * The light hero is live in <FunnelHero>; kept here (V2 frosted-warm) only as a
 * reference for the hero→Q1 handoff. The open decision is the FIRST question's
 * treatment — the relocated dark moment — rendered faithfully (real 6 options,
 * real title, real selected/hover states):
 *   A · navy gradient (deep, premium; strongest light→dark contrast handoff)
 *   B · brand-blue gradient (brighter, louder; leans into the logo blue)
 */

const HERO_IMG = '/portfolio-photos/modern-kitchen-1.jpeg'

// The real Q1 ("layout") options — 4 photo tiles + 2 diagram-icon tiles.
const Q1_OPTIONS = [
  { id: 'l-shape', label: 'L-shaped', kind: 'image', src: '/funnels/kitchens/layout/l-shape.webp' },
  { id: 'u-shape', label: 'U-shaped', kind: 'image', src: '/funnels/kitchens/layout/u-shape.webp' },
  { id: 'galley', label: 'Galley', kind: 'image', src: '/funnels/kitchens/layout/galley.webp' },
  { id: 'island', label: 'Has an island', kind: 'image', src: '/funnels/kitchens/layout/island.webp' },
  { id: 'open', label: 'Open-concept', kind: 'icon' },
  { id: 'not-sure', label: 'Not sure', kind: 'icon' },
] as const

// Frosted-card plate treatment shipped on the hero (V2 warm, blur-lg).
const PLATE_WARM = 'm-3 rounded-2xl bg-[#faf7f1]/80 ring-1 ring-[#0784b3]/12 shadow-xl backdrop-blur-lg @3xl:m-4'

/** Hero reference (shipped V2). */
function HeroContent() {
  const badge = 'inline-flex min-h-10 items-center gap-2 rounded-full border border-black/10 bg-white px-3.5 py-1.5 shadow-sm'
  return (
    <div className={cn('relative flex flex-col items-center gap-5 px-6 py-9 text-center', PLATE_WARM)}>
      <Image src={LogoColor} alt="Tri Pros Remodeling" width={200} height={54} priority className="h-12 w-auto" />
      <h1 className="text-balance font-serif text-[2rem] leading-tight font-bold tracking-tight text-[#211c17]">
        Get a AAA-grade kitchen remodel —
        {' '}
        <span className="text-[#0784b3]">at a Showcase price.</span>
      </h1>
      <p className="max-w-[42ch] text-balance text-lg font-medium text-[#37322b]">
        See if your home qualifies to be featured in our showcase.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className={badge}>
          <span className="text-sm font-semibold text-[#211c17]">Google</span>
          <span className="flex items-center gap-0.5">
            {Array.from({ length: 5 }, (_, i) => <Star key={i} size={13} className="fill-amber-500 text-amber-500" />)}
          </span>
          <span className="text-sm font-semibold text-[#211c17] tabular-nums">4.9</span>
        </span>
        <span className={badge}>
          <span className="text-sm font-semibold text-[#211c17]">BBB</span>
          <span className="text-sm font-semibold text-[#211c17]">A+</span>
        </span>
      </div>
      <FunnelCta className="mt-1 w-full @xs:w-auto">
        See if you qualify
        <ArrowDown className="size-4" />
      </FunnelCta>
    </div>
  )
}

function HeroShell() {
  return (
    <section className="@container relative isolate overflow-hidden rounded-2xl shadow-(--shadow-hero)">
      <Image src={HERO_IMG} alt="" fill priority sizes="(max-width: 640px) 100vw, 1024px" className="-z-10 object-cover object-center" />
      <HeroContent />
    </section>
  )
}

/**
 * Q1 spotlight — faithful to the real CardSelectStepView, on a dark panel.
 * `panel` = the gradient surface; `accentRing` = the selected-tile ring.
 */
function Q1Panel({ panel, accentRing }: { panel: string, accentRing: string }) {
  return (
    <section className={`relative isolate overflow-hidden rounded-2xl p-5 shadow-(--shadow-hero) ${panel}`}>
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className="text-xs font-semibold tracking-[0.18em] text-white/55 uppercase">Start here · Step 1 of 7</span>
        <h2 className="text-2xl font-semibold text-white">Which best describes your kitchen?</h2>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:gap-3">
        {Q1_OPTIONS.map((o, i) => {
          const selected = i === 0
          const Icon = o.kind === 'icon' ? OPTION_ICONS[o.id] : null
          return (
            <button
              key={o.id}
              type="button"
              className={cn(
                'flex flex-col items-center overflow-hidden rounded-lg border text-center backdrop-blur-md transition-colors',
                selected ? `${accentRing} bg-white/20` : 'border-white/15 bg-white/10 hover:border-white/40',
              )}
            >
              <div className="flex aspect-video w-full items-center justify-center bg-black/15">
                {o.kind === 'image'
                  ? <Image src={o.src} alt={o.label} width={600} height={282} sizes="45vw" className="h-full w-full object-cover" />
                  : Icon ? <Icon className="size-9 text-white/90" /> : null}
              </div>
              <span className="block p-2 text-sm font-medium text-white">{o.label}</span>
            </button>
          )
        })}
      </div>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-white/65">
        <Check className="size-3.5" />
        Tap any option to begin — it only takes 60 seconds
      </p>
    </section>
  )
}

export default function TestPage() {
  return (
    <main className="funnel-light min-h-dvh w-full bg-background">
      <div className="mx-auto flex w-full max-w-93.75 flex-col gap-10 px-2.5 py-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-foreground text-xl font-bold">Q1 "dark moment" — A vs B</h1>
          <p className="text-muted-foreground text-sm">
            Hero (shipped) shown for the handoff. Pick the first-question treatment below — both
            render the real 6 options + states. Phone width (375px).
          </p>
        </header>

        {/* Hero → Q1 handoff: A (navy). */}
        <section className="flex flex-col gap-3">
          <h2 className="text-foreground text-base font-semibold">A · navy gradient</h2>
          <HeroShell />
          <Q1Panel panel="bg-linear-to-b from-[#04638f] to-[#031f2e] ring-1 ring-white/10" accentRing="border-2 border-[#7fd6f5]" />
          <Continue />
        </section>

        {/* Hero → Q1 handoff: B (brand-blue). */}
        <section className="flex flex-col gap-3">
          <h2 className="text-foreground text-base font-semibold">B · brand-blue gradient</h2>
          <HeroShell />
          <Q1Panel panel="bg-linear-to-br from-[#0a86c2] via-[#045f87] to-[#04354c] ring-1 ring-white/15" accentRing="border-2 border-white" />
          <Continue />
        </section>
      </div>
    </main>
  )
}

/** The light marketing band that follows Q1 — for handoff context. */
function Continue() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4">
      <span className="text-muted-foreground text-xs">↓ returns to light blocks</span>
      <button type="button" className="inline-flex items-center gap-1.5 text-sm font-medium text-(--accent-ink)">
        Most kitchen remodels go sideways. Here's why.
        <ArrowRight className="size-3.5" />
      </button>
    </div>
  )
}
