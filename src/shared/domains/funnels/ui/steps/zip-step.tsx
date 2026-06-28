import type { StepProps, ZipStep } from '@/shared/domains/funnels/types'
import { Loader2, MapPin } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { FUNNEL_QUESTION_MAX_W } from '@/shared/domains/funnels/constants/funnel-layout'
import { FUNNEL_TRANSITION } from '@/shared/domains/funnels/constants/funnel-motion'
import { getTradeFacts } from '@/shared/domains/funnels/constants/trade-facts'
import { useLiveZipResolve } from '@/shared/domains/funnels/hooks/use-live-zip-resolve'
import { classifyZip } from '@/shared/domains/funnels/lib/resolve-zip'
import { ZipCheckProgress } from '@/shared/domains/funnels/ui/steps/zip-check-progress'
import { useAutoFocus } from '@/shared/hooks/use-auto-focus'

type Phase = 'input' | 'checking' | 'qualified'

export function ZipStepView({ content, value, setValue, ctx }: StepProps<ZipStep>) {
  // Persistence (#7): if this step was already answered (reached via Back),
  // mount directly in the qualified phase with the stored ZIP.
  const [zip, setZip] = useState(value?.zip ?? '')
  const [phase, setPhase] = useState<Phase>(value?.zip ? 'qualified' : 'input')
  const reduceMotion = useReducedMotion()

  // Focus the ZIP field on load — and again when the user drops back to the
  // input phase via "check a different ZIP" (enabled flips false→true).
  const inputRef = useAutoFocus<HTMLInputElement>({ enabled: phase === 'input' })

  // Live resolve as the user types. Seeded with the stored answer so a Back-return
  // shows the badge + enables the button without a refetch.
  const seed = value?.zip ? { zip: value.zip, city: value.city, state: value.state, county: value.county } : null
  const { resolved, pending, notFound } = useLiveZipResolve(zip, seed)

  // Out-of-area messaging path: a complete 5-digit ZIP that isn't in-area.
  const isFullZip = /^\d{5}$/.test(zip)
  const showOutOfArea = isFullZip && !pending && !resolved && !notFound && classifyZip(zip) !== 'in-area'

  function handleSubmit() {
    if (!resolved) {
      return
    }
    // Resolve already happened — play the anticipation beat (#6) FIRST, then
    // commit the answer on completion (in the checking branch's onComplete).
    // The answer is deliberately NOT persisted here: committing `engine.value`
    // makes the engine render its "Next →" nav, which would let the visitor skip
    // the still-running checklist. Holding the commit until the beat finishes
    // keeps `engine.value` null throughout, so there is no Next button to skip.
    // `resolved` is stable across the beat (input is unmounted, so `zip` — the
    // resolve effect's only key — can't change), so onComplete reads it safely.
    setPhase('checking')
  }

  if (phase === 'checking') {
    return (
      <ZipCheckProgress
        input={{ zip: resolved?.zip ?? zip, city: resolved?.city ?? '', trade: getTradeFacts(ctx.slug).name }}
        onComplete={() => {
          if (resolved) {
            setValue({
              zip: resolved.zip,
              city: resolved.city,
              state: resolved.state,
              county: resolved.county,
            })
          }
          setPhase('qualified')
        }}
      />
    )
  }

  if (phase === 'qualified') {
    const place = value?.city ?? ''
    return (
      <div className={`mx-auto flex w-full flex-col items-center gap-4 py-8 text-center ${FUNNEL_QUESTION_MAX_W}`} aria-live="polite">
        <p className="text-foreground text-xl font-semibold">
          {content.qualifiesLabel ?? 'Looks like there\'s still availability in'}
        </p>
        {place
          ? (
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, scale: 0.9, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={FUNNEL_TRANSITION}
                className="border-primary/30 bg-primary/5 inline-flex items-center gap-2 rounded-full border px-4 py-2"
              >
                <MapPin className="text-primary size-4" aria-hidden="true" />
                <span className="text-foreground text-sm font-medium">{place}</span>
              </motion.div>
            )
          : null}
        {/* Persisted ZIP is editable: drop back to input (current ZIP pre-filled)
            so a different area can be checked. Re-checking overwrites the stored
            value. Secondary action — deliberately not the primary color. */}
        <Button variant="ghost" size="sm" onClick={() => setPhase('input')} className="text-muted-foreground">
          Check a different ZIP
        </Button>
      </div>
    )
  }

  const badgePlace = resolved?.city ?? ''

  // Reserved status slot (#2): at most one of these renders, and the slot keeps
  // a fixed min-height even when empty, so the button below never moves.
  const statusMessage = notFound
    ? (content.notFoundLabel ?? 'We couldn\'t find that ZIP.')
    : showOutOfArea
      ? (content.outOfAreaLabel ?? 'We don\'t serve that area yet.')
      : null

  return (
    <div className={`mx-auto flex w-full flex-col gap-6 ${FUNNEL_QUESTION_MAX_W}`}>
      <div className="text-center">
        <h2 className="text-2xl font-semibold">{content.title}</h2>
        {content.subtitle ? <p className="text-muted-foreground mt-1">{content.subtitle}</p> : null}
      </div>

      {/* One tight action cluster: input → CTA → result read as a single unit,
          12px apart, so the button sits right under the field (proximity). The
          result slot is the LAST element; the question stage is top-anchored and
          the engine's Back/Next nav lives OUTSIDE it, so nothing above the slot
          moves when its contents change. */}
      <div className="mx-auto flex w-full max-w-md flex-col gap-3">
        {/* Input row. The live-resolve spinner sits inside the field on the right. */}
        <div className="relative w-full">
          <Input
            ref={inputRef}
            inputMode="numeric"
            maxLength={5}
            placeholder="ZIP code"
            value={zip}
            onChange={e => setZip(e.target.value.replace(/\D/g, ''))}
            className="text-center text-lg"
          />
          {pending
            ? (
                <Loader2
                  className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin"
                  aria-hidden="true"
                />
              )
            : null}
        </div>

        <Button size="lg" className="w-full" disabled={!resolved} onClick={handleSubmit}>
          {content.inputCta ?? 'Check my area'}
        </Button>

        {/* Reserved-height result/error slot, directly under the CTA. Shows EITHER
            the resolved place (lead-in + city pill) OR a validation message OR
            nothing — `resolved` and `statusMessage` are mutually exclusive
            (resolved ⇒ found & in-area). Fixed min-height keeps the swap between
            states shift-free. */}
        <div className="flex min-h-11 items-center justify-center" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            {resolved
              ? (
                  <motion.div
                    key={`place-${resolved.zip}`}
                    initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={FUNNEL_TRANSITION}
                    className="flex flex-wrap items-center justify-center gap-2 text-center"
                  >
                    <span className="text-muted-foreground text-sm">
                      {content.serviceableLabel ?? 'Looks like we service'}
                    </span>
                    <span className="border-primary/30 bg-primary/5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
                      <MapPin className="text-primary size-4 shrink-0" aria-hidden="true" />
                      <span className="text-foreground whitespace-nowrap text-sm font-medium">{badgePlace}</span>
                    </span>
                  </motion.div>
                )
              : statusMessage
                ? (
                    <motion.p
                      key={`msg-${statusMessage}`}
                      initial={reduceMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={FUNNEL_TRANSITION}
                      className="text-muted-foreground text-center text-sm"
                    >
                      {statusMessage}
                    </motion.p>
                  )
                : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
