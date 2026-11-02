import type { ReadingId } from '@/features/trade-scenes/constants/home-anchors'

import { READING_IDS } from '@/features/trade-scenes/constants/home-anchors'

// Readings share the pin registry with the anchors and the assembly kits' part pins, so their ids carry a prefix of their own.
const PREFIX = 'reading:'

export function readingPinId(reading: ReadingId): string {
  return `${PREFIX}${reading}`
}

export function readingFromPinId(id: string): ReadingId | null {
  if (!id.startsWith(PREFIX)) {
    return null
  }
  const reading = id.slice(PREFIX.length)
  return READING_IDS.find(candidate => candidate === reading) ?? null
}
