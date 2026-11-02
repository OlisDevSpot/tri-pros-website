'use client'

import { READING_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { ReadingDisclosure } from '@/features/trade-scenes/ui/components/panel/reading-disclosure'

interface ReadingPinProps {
  label: string
  /** °F */
  value: number
  disclosure: string
}

// A thermal camera's spot reading pinned where it was taken; it sits over the paint, so it carries its own veil.
export function ReadingPin({ label, value, disclosure }: ReadingPinProps) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-scrim/80 py-0.5 pr-0.5 pl-3 text-sm whitespace-nowrap text-on-media shadow-lg">
      <span className="text-on-media-muted">{label}</span>
      <span className="font-semibold tabular-nums">{`${Math.round(value)}${READING_COPY.unit}`}</span>
      <ReadingDisclosure text={disclosure} />
    </div>
  )
}
