import type { ZipCheckInput } from '@/shared/domains/funnels/lib/build-zip-check-sequence'
import { Check } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { buildZipCheckSequence } from '@/shared/domains/funnels/lib/build-zip-check-sequence'

/**
 * Sequential "checking your area" checklist. Pure presentation — the ZIP is
 * already resolved before this mounts, so this just paces an anticipation beat,
 * each line completing with a green check. Honest framing of one check ("we're
 * confirming your area"), not claims of distinct backend calls. The sequence
 * (labels + per-tick cadence) is generated once per mount from `input` via
 * `buildZipCheckSequence` — dynamic labels, random durations, lingering final
 * tick. see ../../lib/build-zip-check-sequence.ts
 */
export function ZipCheckProgress({ input, onComplete }: { input: ZipCheckInput, onComplete?: () => void }) {
  // Build once per mount — durations are random, so this must not re-roll on
  // re-render (a useState initializer pins them for the checklist's lifetime).
  const [sequence] = useState(() => buildZipCheckSequence(input))
  const [done, setDone] = useState(0)
  const firedRef = useRef(false)

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
    <ul className="mx-auto flex max-w-xs flex-col gap-3 py-8" aria-live="polite">
      {sequence.map(({ label }, i) => {
        const complete = i < done
        const active = i === done
        return (
          <li key={label} className="flex items-center gap-3 text-left">
            <span
              className={
                complete
                  ? 'bg-green-600 text-white flex size-6 items-center justify-center rounded-full'
                  : 'border-muted-foreground/40 flex size-6 items-center justify-center rounded-full border-2'
              }
            >
              {complete
                ? <Check className="size-4" />
                : active ? <span className="border-green-600 size-3 animate-spin rounded-full border-2 border-t-transparent" /> : null}
            </span>
            <span className={complete ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
          </li>
        )
      })}
    </ul>
  )
}
