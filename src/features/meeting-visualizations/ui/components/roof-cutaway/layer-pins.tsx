'use client'

import type { AssemblyLayer, LayerId, PinRegistry } from '@/features/meeting-visualizations/types'
import { cn } from '@/shared/lib/utils'

interface LayerPinsProps {
  layers: AssemblyLayer[]
  registry: PinRegistry
  selected: LayerId | null
  /** Pins crowd a closed roof, so they show once it is opened, plus the selected one always. */
  showAll: boolean
  onSelect: (id: LayerId) => void
}

/**
 * Numbered pins over the canvas. Plain DOM rather than a 3D label helper: one React tree, no
 * per-pin roots, and the canvas positions them by writing a transform, never by re-rendering.
 * A pin stays hidden until its layer exists in the scene (`data-anchored`).
 */
export function LayerPins({ layers, registry, selected, showAll, onSelect }: LayerPinsProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {layers.map((layer, index) => {
        if (layer.status === 'missing')
          return null
        const isSelected = selected === layer.id
        const shown = showAll || isSelected
        return (
          <button
            key={layer.id}
            ref={(element) => {
              if (element)
                registry.elements.set(layer.id, element)
              else
                registry.elements.delete(layer.id)
            }}
            type="button"
            aria-label={layer.label}
            aria-pressed={isSelected}
            tabIndex={shown ? 0 : -1}
            onClick={() => onSelect(layer.id)}
            className={cn(
              'absolute top-0 left-0 flex size-11 cursor-pointer items-center justify-center opacity-0 transition-opacity duration-300 focus-visible:outline-none',
              shown && 'data-anchored:pointer-events-auto data-anchored:opacity-100',
            )}
          >
            <span
              className={cn(
                'flex size-7 items-center justify-center rounded-full border text-xs font-bold shadow-lg tabular-nums transition-colors',
                isSelected
                  ? 'border-(--presentation-accent) bg-(--presentation-accent) text-(--presentation-ground)'
                  : 'border-white/70 bg-(--presentation-ground)/80 text-white backdrop-blur-sm',
              )}
            >
              {index + 1}
            </span>
          </button>
        )
      })}
    </div>
  )
}
