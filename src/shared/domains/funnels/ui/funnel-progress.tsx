import { motion, useReducedMotion } from 'motion/react'

export function FunnelProgress({ total, currentIndex }: { total: number, currentIndex: number }) {
  const reduceMotion = useReducedMotion()
  // currentIndex is 0-based; +1 so the first in-funnel step shows real progress.
  const pct = total > 0 ? Math.min(100, Math.round(((currentIndex + 1) / total) * 100)) : 0

  return (
    <div className="bg-border h-1.5 w-full overflow-hidden rounded-full" aria-hidden>
      <motion.div
        className="bg-primary h-full rounded-full"
        initial={reduceMotion ? false : { width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      />
    </div>
  )
}
