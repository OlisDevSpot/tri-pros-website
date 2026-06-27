'use client'

import type { ComponentType, ReactNode } from 'react'
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
import { FunnelFooter } from '@/shared/domains/funnels/ui/footer/funnel-footer'
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

  // One content rail for the whole funnel (see constants/funnel-layout). Every
  // step + the terminal confirmation share this baseline width; the sticky
  // header mirrors it. Focused controls constrain internally.
  const contentWidth = FUNNEL_RAIL_MAX_W

  // Q1 renders as a COMPACT control inside the hero (not the dark spotlight), so
  // the visitor answers without a click to "start". Non-card-select first steps
  // (none today) fall back to the generic step element.
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

  // Three top-level "views". The boundary AnimatePresence below crossfades
  // between them, so hero→Q2 and last-question→confirmation animate like the
  // in-stage question swaps instead of hard-cutting. Within 'steps' the key is
  // stable, so question→question stays owned by the inner stage AnimatePresence.
  const view = engine.isFirst
    ? 'landing'
    : engine.step.kind === 'confirmation'
      ? 'confirmation'
      : 'steps'

  let body: ReactNode
  if (view === 'landing') {
    body = (
      <FunnelLanding spec={spec} ctx={ctx} variant={variant} scrollToQuestionOnMount={engine.value != null}>{heroEntry}</FunnelLanding>
    )
  }
  else if (view === 'confirmation') {
    // The terminal confirmation reads like the hero/landing, NOT a question: it
    // takes the full page height and scrolls with the document — never confined
    // to the fixed question stage, and without the progress bar or nav.
    body = (
      <>
        <FunnelStickyHeader opacity={stickyOpacity} widthClass={contentWidth} />
        <div className={`mx-auto w-full ${contentWidth} px-5 pb-16 pt-20`}>
          {stepEl}
        </div>
        <FunnelFooter ctx={ctx} />
      </>
    )
  }
  else {
    // PII is the submit step: it keeps the fixed question stage like any other
    // step, but the page must scroll to reveal a legal block that peeks ~50% into
    // the fold. So on PII we drop `min-h-dvh` + the spacer (let the cluster take
    // natural height) and render the footer below it; the document then scrolls.
    // Interior steps keep the exact single-viewport behavior (no footer).
    const isPii = engine.step.kind === 'pii-form'
    body = (
      <>
        <FunnelStickyHeader opacity={stickyOpacity} widthClass={contentWidth} />
        <div className={`mx-auto flex w-full flex-col px-5 pb-10 pt-16 ${contentWidth} ${isPii ? '' : 'min-h-dvh'}`}>
          {/* ① Progress — pinned at the top, exactly where it was. */}
          <FunnelProgress total={spec.steps.length} currentIndex={currentIndex} />

          {/* ② Question stage — FIXED-height frame; content scrolls INTERNALLY. */}
          <div className="mt-6 h-[clamp(21rem,56dvh,36rem)] overflow-x-clip overflow-y-auto">
            <div className="overflow-clip">
              <AnimatePresence mode="wait">
                <motion.div
                  key={engine.step.id}
                  initial={reduceMotion ? false : STEP_VARIANTS.initial}
                  animate={STEP_VARIANTS.animate}
                  exit={reduceMotion ? undefined : STEP_VARIANTS.exit}
                  transition={FUNNEL_TRANSITION}
                  className="w-full py-2"
                >
                  {stepEl}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* ③ Nav — directly under the stage at a constant Y. */}
          {engine.hasNext
            ? (
                <div className="mt-6 flex items-center justify-between gap-3">
                  <Button variant="ghost" onClick={engine.back}>← Back</Button>
                  {engine.value != null
                    ? <Button onClick={engine.advance}>Next →</Button>
                    : <span />}
                </div>
              )
            : null}

          {/* Spacer — only when filling the viewport (non-PII). On PII the footer
              below carries the page instead, so the cluster stays its natural
              height and the legal block peeks into the fold. */}
          {isPii ? null : <div className="flex-1" aria-hidden="true" />}
        </div>
        {isPii ? <FunnelFooter ctx={ctx} /> : null}
      </>
    )
  }

  // Boundary crossfade between views. OPACITY only: unlike a transform it does
  // NOT establish a containing block, so the fixed sticky header keeps anchoring
  // to the viewport through the fade. mode="wait" → the two full-height views
  // never stack (which would double page height and jump the scroll).
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={view}
        data-funnel={spec.slug}
        className="min-h-dvh w-full"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0 }}
        transition={FUNNEL_TRANSITION}
      >
        {body}
      </motion.div>
    </AnimatePresence>
  )
}
