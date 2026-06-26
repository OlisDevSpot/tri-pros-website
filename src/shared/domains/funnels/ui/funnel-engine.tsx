'use client'

import type { ComponentType } from 'react'
import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import type { FunnelContext, StepProps } from '@/shared/domains/funnels/types'
import { AnimatePresence, motion, useMotionValue, useReducedMotion } from 'motion/react'
import { useMemo } from 'react'
import { Button } from '@/shared/components/ui/button'
import { FUNNEL_RAIL_MAX_W } from '@/shared/domains/funnels/constants/funnel-layout'
import { FUNNEL_TRANSITION, STEP_VARIANTS } from '@/shared/domains/funnels/constants/funnel-motion'
import { STEP_REGISTRY } from '@/shared/domains/funnels/constants/step-registry'
import { useFunnelEngine } from '@/shared/domains/funnels/hooks/use-funnel-engine'
import { useFunnelUtm } from '@/shared/domains/funnels/hooks/use-funnel-utm'
import { useProgressiveEnrichment } from '@/shared/domains/funnels/hooks/use-progressive-enrichment'
import { getFunnel } from '@/shared/domains/funnels/lib/registry'
import { useFunnelTracking } from '@/shared/domains/funnels/lib/tracking/use-funnel-tracking'
import { FunnelHeroEntry } from '@/shared/domains/funnels/ui/funnel-hero-entry'
import { FunnelLanding } from '@/shared/domains/funnels/ui/funnel-landing'
import { FunnelProgress } from '@/shared/domains/funnels/ui/funnel-progress'
import { FunnelStickyHeader } from '@/shared/domains/funnels/ui/funnel-sticky-header'

/**
 * Accepts `slug` (serializable) and resolves the spec on the client (the spec
 * contains functions and can't cross the server→client boundary).
 *
 * The slim sticky header appears on every screen. On the landing, the hero
 * scroll drives its reveal — so that copy is owned by `FunnelLanding`, which
 * remounts with the hero (see its docblock for why the scroll subscription
 * must live there). On step pages there is no hero to track, so the engine
 * renders an always-visible copy with a constant opacity.
 */
export function FunnelEngine({ slug, variant }: { slug: FunnelSlug, variant?: string }) {
  const spec = getFunnel(slug)
  const engine = useFunnelEngine(spec)
  const utm = useFunnelUtm(slug)
  useFunnelTracking(spec, engine)
  useProgressiveEnrichment(spec, engine.answers)
  const reduceMotion = useReducedMotion()

  // Constant opacity for the header on step pages (no hero scroll to track).
  const stickyOpacity = useMotionValue(1)

  // Ambient funnel-level context handed to every step (e.g. the lead step will
  // read ctx.utm/offer/slug here in 2b — no engine special-case needed).
  const ctx = useMemo<FunnelContext>(
    () => ({ slug: spec.slug, offer: spec.offer, theme: spec.theme, utm, pixel: spec.pixel }),
    [spec, utm],
  )

  const currentIndex = spec.steps.findIndex(s => s.id === engine.step.id)

  // Single documented dispatch seam: the registry is typed per kind, but indexing
  // by a union `kind` widens the lookup. Re-narrow here with the ONE cast; each
  // step component stays fully typed against its own StepProps<S>.
  const StepView = STEP_REGISTRY[engine.step.kind] as ComponentType<StepProps>

  const stepEl = (
    <StepView
      step={engine.step}
      content={engine.step.content}
      value={engine.value}
      isAnswered={engine.value != null}
      setValue={engine.setAnswer}
      answers={engine.answers}
      ctx={ctx}
      advance={engine.advance}
      back={engine.back}
      isFirst={engine.isFirst}
    />
  )

  if (engine.isFirst) {
    // Q1 renders as a COMPACT control inside the hero (not the dark spotlight),
    // so the visitor answers without a click to "start". Non-card-select first
    // steps (none today) fall back to the generic step element.
    const heroEntry = engine.step.kind === 'card-select'
      ? (
          <FunnelHeroEntry
            content={engine.step.content}
            value={engine.value}
            isAnswered={engine.value != null}
            setValue={engine.setAnswer}
            advance={engine.advance}
          />
        )
      : stepEl
    return (
      <div data-funnel={spec.slug} className="min-h-dvh w-full">
        <FunnelLanding spec={spec} ctx={ctx} variant={variant} scrollToQuestionOnMount={engine.value != null}>{heroEntry}</FunnelLanding>
      </div>
    )
  }

  // One content rail for the whole funnel (see constants/funnel-layout). Every
  // step + the terminal confirmation share this baseline width; the sticky
  // header mirrors it. Focused controls constrain internally.
  const contentWidth = FUNNEL_RAIL_MAX_W

  return (
    <div data-funnel={spec.slug} className="min-h-dvh w-full">
      <FunnelStickyHeader opacity={stickyOpacity} widthClass={contentWidth} />
      {/* Decoupled three-zone scaffold (see the funnel UX notes): the progress
          bar, the question, and the nav are INDEPENDENT regions so each holds its
          own position. Progress pins to the top; the question lives on a
          fixed-height stage; the nav holds a constant Y. Nothing re-centers as a
          group, so step-to-step height changes never move the progress bar or the
          buttons — predictable, minimal layout shift. */}
      <div className={`mx-auto flex min-h-dvh w-full flex-col px-5 pb-10 pt-16 ${contentWidth}`}>
        {/* ① Progress — pinned at the top, exactly where it was. */}
        <FunnelProgress total={spec.steps.length} currentIndex={currentIndex} />

        {/* ② Question stage — a FIXED-height frame between progress and nav. Its
            outer box never resizes (not between a tall and a short question, not
            mid cross-fade), so ① and ③ never move. Content centers inside
            (min-h-full + justify-center); a taller-than-frame question scrolls
            INTERNALLY and can never push the page. */}
        <div className="mt-6 h-[clamp(21rem,56dvh,36rem)] overflow-x-clip overflow-y-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={engine.step.id}
              initial={reduceMotion ? false : STEP_VARIANTS.initial}
              animate={STEP_VARIANTS.animate}
              exit={reduceMotion ? undefined : STEP_VARIANTS.exit}
              transition={FUNNEL_TRANSITION}
              className="flex min-h-full w-full flex-col justify-start py-2"
            >
              {stepEl}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ③ Nav — directly under the stage at a constant Y (upper-middle). */}
        {engine.hasNext
          ? (
              <div className="mt-6 flex items-center justify-between gap-3">
                <Button variant="ghost" onClick={engine.back}>← Back</Button>
                {/* Next stays available for ANY answered step (uniform rule). On
                    card-select a tap also advances, but Next is the no-re-tap path
                    for a Back-revisiting user who's keeping their answer. */}
                {engine.value != null
                  ? <Button onClick={engine.advance}>Next →</Button>
                  : <span />}
              </div>
            )
          : null}

        {/* Spacer — absorbs the rest of the viewport so the cluster stays
            top-anchored and the nav keeps a constant Y instead of floating down. */}
        <div className="flex-1" aria-hidden="true" />
      </div>
    </div>
  )
}
