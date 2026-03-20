'use client'

import { useEffect, useState } from 'react'

interface Props {
  startHour?: number
  endHour?: number
}

export function CalendarTimeIndicator({ startHour = 8, endHour = 22 }: Props) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  const hours = now.getHours()
  const minutes = now.getMinutes()
  const currentMinutes = hours * 60 + minutes
  const rangeStart = startHour * 60
  const rangeEnd = endHour * 60

  if (currentMinutes < rangeStart || currentMinutes > rangeEnd) {
    return null
  }

  const topPercent = ((currentMinutes - rangeStart) / (rangeEnd - rangeStart)) * 100

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
