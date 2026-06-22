import type { StepProps, ZipStep } from '@/shared/domains/funnels/types'
import { Loader2, MapPin } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { FUNNEL_QUESTION_MAX_W } from '@/shared/domains/funnels/constants/funnel-layout'
import { FUNNEL_TRANSITION } from '@/shared/domains/funnels/constants/funnel-motion'
import { CHECK_DURATIONS, CHECK_STEPS } from '@/shared/domains/funnels/constants/zip-check'
import { useLiveZipResolve } from '@/shared/domains/funnels/hooks/use-live-zip-resolve'
import { classifyZip } from '@/shared/domains/funnels/lib/resolve-zip'
import { ZipCheckProgress } from '@/shared/domains/funnels/ui/steps/zip-check-progress'
import { useAutoFocus } from '@/shared/hooks/use-auto-focus'

type Phase = 'input' | 'checking' | 'qualified'

export function ZipStepView({ content, value, setValue }: StepProps<ZipStep>) {
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
    // Resolve already happened — persist the resolved value, then play the
    // anticipation beat (#6) before advancing to qualified.
    setValue({
      zip: resolved.zip,
      city: resolved.city,
      state: resolved.state,
      county: resolved.county,
    })
    setPhase('checking')
  }

  if (phase === 'checking') {
    return (
      <ZipCheckProgress
        steps={CHECK_STEPS}
        durations={CHECK_DURATIONS}
        onComplete={() => setPhase('qualified')}
      />
    )
  }

  if (phase === 'qualified') {
    const place = value?.city ?? ''
    return (
      <div className={`mx-auto flex w-full flex-col items-center gap-4 py-8 text-center ${FUNNEL_QUESTION_MAX_W}`} aria-live="polite">
        <p className="text-foreground text-xl font-semibold">
          {content.qualifiesLabel ?? '✓ Great news — your area qualifies.'}
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

      {/* Horizontal row (#1): input + badge share one line. No badge → the input
          owns the full width; on resolve the badge slides in from the right and
          the input gives way. The row carries `layout`; the input uses
          `layout="position"` so its width snaps (no scaleX → no text distortion)
          while position stays continuous (#1). Fixed-height row → no vertical
          shift regardless of badge/spinner state (#2). */}
      <motion.div layout={!reduceMotion} className="mx-auto flex w-full max-w-md items-center gap-2">
        <motion.div layout={reduceMotion ? false : 'position'} className="relative min-w-0 flex-1">
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
        </motion.div>
        {/* Resolved place badge. The chip fades via opacity while `layout`
            projection keeps its position continuous as the input gives way — no
            scale keyframe, so nothing fights the projection (#1). The inner span
            carries a translate-only slide-from-right; translate (unlike scale)
            composes cleanly with layout projection and never distorts the text. */}
        <AnimatePresence mode="wait" initial={false}>
          {resolved
            ? (
                <motion.div
                  key={resolved.zip}
                  layout={!reduceMotion}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={FUNNEL_TRANSITION}
                  className="border-primary/30 bg-primary/5 inline-flex shrink-0 items-center rounded-full border px-3 py-2"
                >
                  <motion.span
                    initial={reduceMotion ? false : { x: 10 }}
                    animate={{ x: 0 }}
                    transition={FUNNEL_TRANSITION}
                    className="inline-flex items-center gap-2"
                  >
                    <MapPin className="text-primary size-4 shrink-0" aria-hidden="true" />
                    <span className="text-foreground whitespace-nowrap text-sm font-medium">{badgePlace}</span>
                  </motion.span>
                </motion.div>
              )
            : null}
        </AnimatePresence>
      </motion.div>

      {/* Reserved status slot (#2/#3): fixed min-height so the button never moves
          across empty / pending / resolved / not-found / out-of-area states. */}
      <p aria-live="polite" className="text-muted-foreground -my-2 min-h-10 text-center text-sm">
        {statusMessage}
      </p>

      <Button size="lg" disabled={!resolved} onClick={handleSubmit}>
        {content.inputCta ?? 'Check my area'}
      </Button>
    </div>
  )
}

/** Importable prebuilt step (Seam A). Spread + override `content` to customize per funnel. */
export const ZIP_STEP: ZipStep = {
  id: 'zip',
  kind: 'zip',
  content: {
    title: 'Where is your home?',
    subtitle: 'We select Showcase homes by area.',
    inputCta: 'Check my area',
    checkingLabel: 'Checking availability in {zip}…',
    qualifiesLabel: '✓ Great news — your area qualifies. Limited spots remain.',
    outOfAreaLabel: 'We don\'t serve that area yet — double-check your ZIP.',
    notFoundLabel: 'We couldn\'t find that ZIP — double-check it.',
  },
}
