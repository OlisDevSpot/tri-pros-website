import { useCallback, useEffect, useRef, useState } from 'react'

const COOLDOWN_MS = 30_000

export function useCreditCooldown() {
  const [remainingMs, setRemainingMs] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startCooldown = useCallback(() => {
    setRemainingMs(COOLDOWN_MS)

    if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    timerRef.current = setInterval(() => {
      setRemainingMs((prev) => {
        if (prev <= 1000) {
          if (timerRef.current) {
            clearInterval(timerRef.current)
          }
          return 0
        }
        return prev - 1000
      })
    }, 1000)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  return {
    isCoolingDown: remainingMs > 0,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    startCooldown,
  }
}
