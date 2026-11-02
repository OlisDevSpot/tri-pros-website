'use client'

import type { AssemblyLayer, LayerId, LayerStatus } from '@/features/meeting-visualizations/types'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/shared/lib/utils'

const STATUS_LABEL: Record<LayerStatus, string> = {
  existing: 'Kept',
  aged: 'Original',
  new: 'New',
  missing: 'Missing',
}

interface LayerListProps {
  layers: AssemblyLayer[]
  selected: LayerId | null
  onSelect: (id: LayerId) => void
}

/** The accessible twin of the canvas: every layer, in build order, including the ones that are not there. */
export function LayerList({ layers, selected, onSelect }: LayerListProps) {
  return (
    <ol className="grid gap-1">
      {layers.map((layer, index) => {
        const isSelected = selected === layer.id
        return (
          <li key={layer.id}>
            <button
              type="button"
              aria-expanded={isSelected}
              onClick={() => onSelect(layer.id)}
              className={cn(
                'grid min-h-11 w-full cursor-pointer grid-cols-[1.75rem_1fr_auto] items-center gap-x-3 rounded-lg px-2 py-1.5 text-left transition-colors',
                'focus-visible:outline-2 focus-visible:outline-(--presentation-accent)',
                isSelected ? 'bg-white/12' : 'hover:bg-white/6',
              )}
            >
              <span
                className={cn(
                  'flex size-7 items-center justify-center rounded-full border text-xs font-bold tabular-nums',
                  isSelected ? 'border-(--presentation-accent) bg-(--presentation-accent) text-(--presentation-ground)' : 'border-white/40 text-white/80',
                  layer.status === 'missing' && 'border-dashed text-white/50',
                )}
              >
                {index + 1}
              </span>
              <span className={cn('text-base font-semibold', layer.status === 'missing' && 'text-white/60 line-through decoration-white/40')}>
                {layer.label}
              </span>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-bold tracking-wide uppercase',
                  layer.status === 'new' && 'bg-(--presentation-accent)/20 text-(--presentation-accent)',
                  layer.status === 'missing' && 'border border-dashed border-white/40 text-white/70',
                  (layer.status === 'aged' || layer.status === 'existing') && 'text-white/50',
                )}
              >
                {STATUS_LABEL[layer.status]}
              </span>
              <AnimatePresence initial={false}>
                {isSelected && (
                  <motion.span
                    key={`${layer.id}-detail`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="col-start-2 col-end-4 overflow-hidden"
                  >
                    <span className="block pt-1 pb-1 text-sm text-pretty text-white/75">{layer.detail}</span>
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
