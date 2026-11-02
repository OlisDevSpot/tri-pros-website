'use client'

import type { ResolvedPart } from '@/shared/modules/construction/core/types'

import { AnimatePresence, motion } from 'motion/react'
import { useId } from 'react'

import { PART_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { SCENE_MOTION } from '@/shared/components/scene/constants/scene-motion'
import { cn } from '@/shared/lib/utils'

interface PartListProps {
  parts: readonly ResolvedPart[]
  emphasized: string | null
  onEmphasize: (partId: string) => void
}

// The accessible twin of the zoomed kit: every part from the inside out, the ones that are not there included, numbered as
// their pins are. Tapping a row emphasises its part and opens what it means.
export function PartList({ parts, emphasized, onEmphasize }: PartListProps) {
  const labelId = useId()
  return (
    <section aria-labelledby={labelId} className="grid gap-1.5">
      <h2 id={labelId} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{PART_COPY.listLabel}</h2>
      <ol className="grid gap-0.5">
        {parts.map((part, index) => {
          const selected = emphasized === part.id
          const absent = part.condition === 'absent'
          return (
            <li key={part.id}>
              <button
                type="button"
                aria-expanded={selected}
                onClick={() => onEmphasize(part.id)}
                className={cn(
                  'grid min-h-11 w-full cursor-pointer grid-cols-[1.75rem_1fr_auto] items-center gap-x-3 rounded-lg px-2 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-(--presentation-accent)',
                  selected ? 'bg-row-selected' : 'hover:bg-hover',
                )}
              >
                <span
                  className={cn(
                    'grid size-7 place-items-center rounded-full border text-xs font-bold tabular-nums',
                    selected ? 'border-(--presentation-accent) bg-(--presentation-accent) text-primary-foreground' : 'border-control-border text-muted-foreground',
                    absent && 'border-dashed',
                  )}
                >
                  {index + 1}
                </span>
                <span className={cn('text-base font-semibold', absent && 'text-muted-foreground')}>{part.label}</span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-bold tracking-wide uppercase',
                    part.condition === 'installed' ? 'bg-(--presentation-accent)/20 text-(--presentation-accent)' : 'text-muted-foreground',
                    absent && 'border border-dashed border-control-border',
                  )}
                >
                  {PART_COPY.condition[part.condition]}
                </span>
                <AnimatePresence initial={false}>
                  {selected && part.detail !== '' && (
                    <motion.span
                      key={`${part.id}-detail`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={SCENE_MOTION.transition}
                      className="col-start-2 col-end-4 overflow-hidden"
                    >
                      <span className="block pt-1 pb-1 text-sm text-pretty text-muted-foreground">{part.detail}</span>
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
