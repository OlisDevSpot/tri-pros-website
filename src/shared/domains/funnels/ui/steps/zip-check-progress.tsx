import type { ZipCheckInput } from '@/shared/domains/funnels/lib/build-zip-check-sequence'
import { Check, MapPin } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { FUNNEL_QUESTION_MAX_W } from '@/shared/domains/funnels/constants/funnel-layout'
import { buildZipCheckSequence } from '@/shared/domains/funnels/lib/build-zip-check-sequence'
import { cn } from '@/shared/lib/utils'

/**
 * "Checking your area" anticipation beat. The ZIP is already resolved before this
 * mounts, so this is pure choreography — an honest pause framed as a live scan of
 * the user's specific area, not claims of distinct backend calls. Two coordinated
 * pieces: a sonar map-pin centerpiece (primary = "scanning") and a vertical
 * timeline spine whose connectors fill green as each line confirms (green =
 * "verified"). Tokens only → brand-safe and identical across every funnel. All
 * ambient/looping motion is gated on useReducedMotion(); when reduced, states
 * still resolve, they just don't pulse or spin.
 *
 * The sequence (labels + per-tick cadence) is generated once per mount from
 * `input` via `buildZipCheckSequence` — dynamic labels, random durations,
 * lingering final tick. see ../../lib/build-zip-check-sequence.ts
 */
export function ZipCheckProgress({ input, onComplete }: { input: ZipCheckInput, onComplete?: () => void }) {
  // Build once per mount — durations are random, so this must not re-roll on
  // re-render (a useState initializer pins them for the checklist's lifetime).
  const [sequence] = useState(() => buildZipCheckSequence(input))
  const [done, setDone] = useState(0)
  const firedRef = useRef(false)
  const reduceMotion = useReducedMotion()
  const place = input.city || input.zip

  useEffect(() => {
    if (done >= sequence.length) {
      return
    }
    const t = setTimeout(() => setDone(d => d + 1), sequence[done].duration)
    return () => clearTimeout(t)
  }, [done, sequence])

  // Fire onComplete exactly once when all steps finish.
  useEffect(() => {
    if (done >= sequence.length && !firedRef.current) {
      firedRef.current = true
      onComplete?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, sequence.length])

  return (
    <div className={cn('mx-auto flex w-full flex-col items-center gap-8 py-6', FUNNEL_QUESTION_MAX_W)}>
      {/* Sonar centerpiece — concentric rings ripple out from a map pin, reading
          as a live scan locked onto the user's area. Rings loop only when motion
          is allowed; the static pin + disc carry the meaning otherwise. */}
      <div className="relative flex size-28 items-center justify-center">
        {!reduceMotion
          ? [0, 1, 2].map(ring => (
              <motion.span
                key={ring}
                className="border-primary/40 absolute inset-0 rounded-full border"
                initial={{ scale: 0.35, opacity: 0.55 }}
                animate={{ scale: 1, opacity: 0 }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut', delay: ring * 0.8 }}
              />
            ))
          : null}
        <div className="bg-primary/10 ring-primary/15 relative flex size-16 items-center justify-center rounded-full ring-1">
          <MapPin className="text-primary size-7" aria-hidden="true" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 text-center">
        <h2 className="text-foreground text-2xl font-semibold">Checking your area</h2>
        <p className="text-muted-foreground text-sm">
          Confirming availability near
          {' '}
          <span className="text-foreground font-medium">{place}</span>
        </p>
      </div>

      {/* Vertical timeline spine. Each row's rail cell holds a status dot and a
          flex-1 connector that stretches to the next dot; the connector turns
          green once its step confirms, so the spine fills top-down as the scan
          completes. The status row carries aria-live for SR announcements. */}
      <ol className="flex w-full max-w-sm flex-col" aria-live="polite">
        {sequence.map(({ label }, i) => {
          const complete = i < done
          const active = i === done
          const isLast = i === sequence.length - 1
          return (
            <li key={label} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-300',
                    complete && 'border-green-600 bg-green-600 text-white',
                    active && 'border-primary bg-primary/5',
                    !complete && !active && 'border-muted-foreground/25 bg-transparent',
                  )}
                >
                  {complete
                    ? (
                        <motion.span
                          initial={reduceMotion ? false : { scale: 0, rotate: -25 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', stiffness: 460, damping: 18 }}
                        >
                          <Check className="size-4" strokeWidth={3} />
                        </motion.span>
                      )
                    : active
                      ? (
                          <motion.span
                            className="border-primary size-3.5 rounded-full border-2 border-t-transparent"
                            animate={reduceMotion ? undefined : { rotate: 360 }}
                            transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                          />
                        )
                      : null}
                </span>
                {!isLast
                  ? (
                      <span
                        className={cn(
                          'my-1 w-0.5 flex-1 rounded-full transition-colors duration-500',
                          complete ? 'bg-green-600' : 'bg-border',
                        )}
                      />
                    )
                  : null}
              </div>
              <div className={cn('pt-0.5', isLast ? 'pb-0' : 'pb-6')}>
                <span
                  className={cn(
                    'text-sm transition-colors duration-300',
                    complete && 'text-foreground/60',
                    active && 'text-foreground font-medium',
                    !complete && !active && 'text-muted-foreground/50',
                  )}
                >
                  {label}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
