'use client'

import { useEffect, useState } from 'react'

export function CalendarTimeIndicator() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  const hours = now.getHours()
  const minutes = now.getMinutes()
  const topPercent = ((hours * 60 + minutes) / (24 * 60)) * 100

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-10"
      style={{ top: `${topPercent}%` }}
    >
      <div className="flex items-center">
        <div className="-ml-1 h-2.5 w-2.5 rounded-full bg-red-500" />
        <div className="flex-1 border-t border-red-500" />
      </div>
    </div>
  )
}
