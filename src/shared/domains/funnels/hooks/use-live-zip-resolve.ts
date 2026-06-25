import type { ResolvedZip } from '@/shared/domains/funnels/lib/resolve-zip'
import { useEffect, useState } from 'react'
import { classifyZip, resolveZip } from '@/shared/domains/funnels/lib/resolve-zip'

/** Debounce before firing a live resolve on a valid in-area ZIP. */
const RESOLVE_DEBOUNCE_MS = 350

interface LiveZipResolve {
  /** The resolved location, or null when the ZIP isn't a resolvable in-area ZIP. */
  resolved: ResolvedZip | null
  /** True while a debounced resolve is in flight (for the inline spinner). */
  pending: boolean
  /**
   * True when the API definitively reports this in-area-format ZIP doesn't
   * exist (zippopotam 404). NEVER set for an aborted/transient request, and
   * cleared on every new input. Lets the step show a "couldn't find that ZIP"
   * message without conflating it with the out-of-area path.
   */
  notFound: boolean
}

/**
 * Resolves a SoCal ZIP live as the user types: debounced (~350ms), gated on
 * `classifyZip(zip) === 'in-area'`, with an AbortController so fast typing /
 * deleting cancels stale in-flight requests (the effect cleanup aborts on every
 * keystroke). Anything else (short, invalid, out-of-area) clears `resolved`. A
 * local CA-cache hit resolves synchronously inside resolveZip.
 *
 * On a definitive 404 it sets `notFound` (a real error surface); a transient or
 * aborted request never sets it. Both are distinguished via the discriminated
 * `ResolveZipResult` returned by `resolveZip`.
 *
 * `seed` lets a Back-return mount with the already-stored location shown without
 * refetching — used only while `zip` still equals the seeded ZIP.
 */
export function useLiveZipResolve(zip: string, seed: ResolvedZip | null): LiveZipResolve {
  const seedMatches = seed != null && seed.zip === zip
  const [resolved, setResolved] = useState<ResolvedZip | null>(seedMatches ? seed : null)
  const [pending, setPending] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    // Back-return: stored location already valid for this ZIP — no refetch.
    if (seedMatches) {
      setResolved(seed)
      setPending(false)
      setNotFound(false)
      return
    }

    // Any new/incomplete/invalid input clears a stale not-found immediately.
    if (classifyZip(zip) !== 'in-area') {
      setResolved(null)
      setPending(false)
      setNotFound(false)
      return
    }

    const ac = new AbortController()
    setPending(true)
    setResolved(null)
    setNotFound(false)

    const timer = setTimeout(async () => {
      const result = await resolveZip(zip, { signal: ac.signal })
      // Guard every setState on the live signal: an aborted (stale) request
      // must never touch state — no resolved, no notFound, no toast.
      if (ac.signal.aborted) {
        return
      }
      setPending(false)
      if (result.status === 'ok') {
        setResolved(result.data)
        setNotFound(false)
      }
      else if (result.status === 'not-found') {
        setResolved(null)
        setNotFound(true)
      }
      else {
        // Transient error — leave the UI neutral (no badge, no error message).
        setResolved(null)
        setNotFound(false)
      }
    }, RESOLVE_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      ac.abort()
    }
    // Keyed on zip only; `seed` is read via the `seedMatches` snapshot above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zip])

  return { resolved, pending, notFound }
}
