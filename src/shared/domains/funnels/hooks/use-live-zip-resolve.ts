import type { ResolvedZip } from '@/shared/domains/funnels/lib/resolve-zip'
import { useEffect, useState } from 'react'
import { RESOLVE_DEBOUNCE_MS } from '@/shared/domains/funnels/constants/zip-check'
import { classifyZip, resolveZip } from '@/shared/domains/funnels/lib/resolve-zip'

interface LiveZipResolve {
  /** The resolved location, or null when the ZIP isn't a resolvable in-area ZIP. */
  resolved: ResolvedZip | null
  /** True while a debounced resolve is in flight (for the inline spinner). */
  pending: boolean
}

/**
 * Resolves a SoCal ZIP live as the user types: debounced (~350ms), gated on
 * `classifyZip(zip) === 'in-area'`, with an AbortController so fast typing /
 * deleting cancels stale in-flight requests (the effect cleanup aborts on every
 * keystroke). Anything else (short, invalid, out-of-area, 404) clears
 * `resolved`. A local CA-cache hit resolves synchronously inside resolveZip.
 *
 * `seed` lets a Back-return mount with the already-stored location shown without
 * refetching — used only while `zip` still equals the seeded ZIP.
 */
export function useLiveZipResolve(zip: string, seed: ResolvedZip | null): LiveZipResolve {
  const seedMatches = seed != null && seed.zip === zip
  const [resolved, setResolved] = useState<ResolvedZip | null>(seedMatches ? seed : null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    // Back-return: stored location already valid for this ZIP — no refetch.
    if (seedMatches) {
      setResolved(seed)
      setPending(false)
      return
    }

    if (classifyZip(zip) !== 'in-area') {
      setResolved(null)
      setPending(false)
      return
    }

    const ac = new AbortController()
    setPending(true)
    setResolved(null)

    const timer = setTimeout(async () => {
      try {
        const result = await resolveZip(zip, { signal: ac.signal })
        if (!ac.signal.aborted) {
          setResolved(result)
          setPending(false)
        }
      }
      catch {
        if (!ac.signal.aborted) {
          setResolved(null)
          setPending(false)
        }
      }
    }, RESOLVE_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      ac.abort()
    }
    // Keyed on zip only; `seed` is read via the `seedMatches` snapshot above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zip])

  return { resolved, pending }
}
