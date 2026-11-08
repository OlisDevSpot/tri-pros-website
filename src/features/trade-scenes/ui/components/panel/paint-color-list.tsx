'use client'

import type { CoolLifeColorId } from '@/shared/modules/construction/core/constants/cool-life-colors'

import { ArrowUpRightIcon, ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { CONTROLS_COPY, PAINT_COLOR_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { ColorSwatches } from '@/features/trade-scenes/ui/components/panel/color-swatches'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { COOL_LIFE_COLORS, COOL_LIFE_FAMILIES, COOL_LIFE_FAN_DECK_URL, COOL_LIFE_QUICK_COLOR_IDS } from '@/shared/modules/construction/core/constants/cool-life-colors'

const QUICK_COLORS = COOL_LIFE_QUICK_COLOR_IDS.map(id => COOL_LIFE_COLORS.find(color => color.id === id)!)
const FAMILIES = COOL_LIFE_FAMILIES.map(family => ({ ...family, colors: COOL_LIFE_COLORS.filter(color => color.family === family.id) }))

interface PaintColorListProps {
  label: string
  value: CoolLifeColorId | null
  onPick: (id: CoolLifeColorId) => void
}

// The short row answers most homes; the fuller list stays folded so the details fit the card until the rep asks for it.
export function PaintColorList({ label, value, onPick }: PaintColorListProps) {
  const [open, setOpen] = useState(false)
  const name = value === null ? PAINT_COLOR_COPY.notPicked : COOL_LIFE_COLORS.find(color => color.id === value)!.name

  return (
    <div className="grid gap-2">
      <span className={CONTROLS_CLASSES.capsLabel}>{`${label}${CONTROLS_COPY.systems.valueJoin}${name}`}</span>
      <ColorSwatches label={label} colors={QUICK_COLORS} value={value} onPick={onPick} />
      {/* The negative inset lines the words up with the swatches while the hover fill keeps its own padding. */}
      <Button
        type="button"
        variant="ghost"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="-mx-2 h-10 justify-self-start px-2 font-bold has-[>svg]:px-2 text-muted-foreground hover:text-foreground"
      >
        {open ? PAINT_COLOR_COPY.fewer : PAINT_COLOR_COPY.more}
        <ChevronDownIcon aria-hidden className={cn('transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
      </Button>
      {open && (
        <>
          {FAMILIES.map(family => (
            <div key={family.id} className="grid gap-2">
              {/* Not in caps: under the part's caps label, so the next part's label still stands out down the open list. */}
              <span className="text-xs font-bold text-muted-foreground">{family.name}</span>
              <ColorSwatches label={`${label}${CONTROLS_COPY.systems.valueJoin}${family.name}`} colors={family.colors} value={value} onPick={onPick} />
            </div>
          ))}
          <Button asChild variant="link" className="h-10 justify-self-start px-0 font-bold has-[>svg]:px-0">
            <a href={COOL_LIFE_FAN_DECK_URL} target="_blank" rel="noopener noreferrer">
              {PAINT_COLOR_COPY.fanDeck}
              <ArrowUpRightIcon aria-hidden />
            </a>
          </Button>
        </>
      )}
    </div>
  )
}
