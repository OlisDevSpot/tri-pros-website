import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * Sequential "checking your area" checklist. Presentation pacing over the real
 * (instant) ZIP resolve — each line completes with a green check. Honest framing
 * of one check ("we're confirming your area"), not claims of distinct backend calls.
 */
export function ZipCheckProgress({ steps, stepMs = 450 }: { steps: string[], stepMs?: number }) {
  const [done, setDone] = useState(0)
  useEffect(() => {
    if (done >= steps.length) {
      return
    }
    const t = setTimeout(() => setDone(d => d + 1), stepMs)
    return () => clearTimeout(t)
  }, [done, steps.length, stepMs])

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
