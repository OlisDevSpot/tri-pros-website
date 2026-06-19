import { useCallback, useRef } from 'react'

/**
 * Wraps an async validator with a debounce + AbortController so it fits RHF's
 * `validate` option. Resolves `true` on abort (a superseded value validates
 * itself), so a stale request never flashes an error.
 */
export function useDebouncedAsyncValidator<T>(
  fn: (value: T, signal: AbortSignal) => Promise<true | string>,
  delayMs = 600,
): (value: T) => Promise<true | string> {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  return useCallback((value: T) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    return new Promise<true | string>((resolve) => {
      timerRef.current = setTimeout(async () => {
        try {
          resolve(await fn(value, ac.signal))
        }
        catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            resolve(true)
          }
          else {
            resolve(true) // network error → fail open; the server gate is authoritative
          }
        }
      }, delayMs)
    })
  }, [fn, delayMs])
}
