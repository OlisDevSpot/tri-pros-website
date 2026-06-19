import { useCallback, useEffect, useRef } from 'react'

/**
 * Wraps an async validator with a debounce + AbortController so it fits RHF's
 * `validate` option.
 *
 * When a call is superseded (next keystroke, or `handleSubmit` re-validating on
 * submit), the PREVIOUS pending promise is resolved `true` — a superseded value
 * validates itself; the new call is authoritative. This is load-bearing: if we
 * only `clearTimeout` the prior call (so its `fn` never runs) without resolving
 * its promise, RHF is left awaiting a promise that can never settle, the field
 * stays `isValidating`, and `handleSubmit` hangs forever. Clicking submit blurs
 * the field (starting a debounced validation) microseconds before the submit
 * re-validates, so this race is hit on the very first submit.
 */
export function useDebouncedAsyncValidator<T>(
  fn: (value: T, signal: AbortSignal) => Promise<true | string>,
  delayMs = 600,
): (value: T) => Promise<true | string> {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const resolveRef = useRef<((result: true | string) => void) | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      abortRef.current?.abort()
      resolveRef.current?.(true)
    }
  }, [])

  return useCallback((value: T) => {
    // Supersede the previous pending validation: clear its timer, abort its
    // in-flight request, and RESOLVE its promise `true` (idempotent if it has
    // already settled) so RHF never waits on a promise that can no longer fire.
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    abortRef.current?.abort()
    resolveRef.current?.(true)

    const ac = new AbortController()
    abortRef.current = ac

    return new Promise<true | string>((resolve) => {
      resolveRef.current = resolve
      timerRef.current = setTimeout(async () => {
        try {
          resolve(await fn(value, ac.signal))
        }
        catch {
          resolve(true) // abort/network error → fail open; the server gate is authoritative
        }
      }, delayMs)
    })
  }, [fn, delayMs])
}
