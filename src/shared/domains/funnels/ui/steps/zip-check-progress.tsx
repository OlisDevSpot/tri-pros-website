import { Check } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/**
 * Sequential "checking your area" checklist. Pure presentation — the ZIP is
 * already resolved before this mounts, so this just paces an anticipation beat,
 * each line completing with a green check. Honest framing of one check ("we're
 * confirming your area"), not claims of distinct backend calls. `durations` is
 * one cadence (ms) per step, so the sequence can vary (e.g. a lingering final
 * step) instead of a flat tick.
 */
export function ZipCheckProgress({ steps, durations, onComplete }: { steps: string[], durations: number[], onComplete?: () => void }) {
  const [done, setDone] = useState(0)
  const firedRef = useRef(false)

  useEffect(() => {
    if (done >= steps.length) {
      return
    }
    const t = setTimeout(() => setDone(d => d + 1), durations[done] ?? 450)
    return () => clearTimeout(t)
  }, [done, steps.length, durations])

  // Fire onComplete exactly once when all steps finish.
  useEffect(() => {
    if (done >= steps.length && !firedRef.current) {
      firedRef.current = true
      onComplete?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, steps.length])

  return (
    <ul className="mx-auto flex max-w-xs flex-col gap-3 py-8" aria-live="polite">
      {steps.map((label, i) => {
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
