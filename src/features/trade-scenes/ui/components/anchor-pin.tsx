'use client'

import type { HomeAnchorId } from '@/features/trade-scenes/constants/home-anchors'

import { ScanSearchIcon } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'

interface AnchorPinProps {
  anchor: HomeAnchorId
  label: string
  onSelect: () => void
}

// A tap target pinned to an anchor on the home; the pulse says the spot opens, and stops for reduced motion.
export function AnchorPin({ anchor, label, onSelect }: AnchorPinProps) {
  return (
    <Button data-anchor-pin={anchor} variant="outline" onClick={onSelect} className="min-h-11 gap-2 rounded-full py-1.5 pr-4 pl-1.5 shadow-lg">
      <span className="relative grid size-8 place-items-center rounded-full bg-(--presentation-accent) text-primary-foreground">
        <span aria-hidden className="absolute inset-0 rounded-full bg-(--presentation-accent) opacity-50 motion-safe:animate-ping" />
        <ScanSearchIcon aria-hidden className="relative size-4" />
      </span>
      {label}
    </Button>
  )
}
