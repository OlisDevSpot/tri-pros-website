'use client'

import type { FilterDefinition, FilterValue } from '@/shared/dal/client/lib/types'

import { AnimatePresence, motion } from 'motion/react'
import { useMemo } from 'react'

import { KEYBOARD_HINT_TEXT } from '@/shared/components/query-toolbar/constants/keyboard-hints'
import { useQueryToolbarContext } from '@/shared/components/query-toolbar/lib/context'
import { FilterChip } from '@/shared/components/query-toolbar/ui/filter-chip'
import { cn } from '@/shared/lib/utils'

interface ActiveChip {
  definition: FilterDefinition
  value: NonNullable<FilterValue>
}

interface ChipRailProps {
  /** `inline` is auto-injected by `<Bar>`; its empty state shows the keyboard hint so the bar never grows a second row. */
  placement?: 'inline' | 'block'
}

export function QueryToolbarChipRail({ placement = 'block' }: ChipRailProps) {
  const { filterDefinitions, filters, setFilter } = useQueryToolbarContext()

  const active = useMemo<ActiveChip[]>(() => {
    const result: ActiveChip[] = []
    for (const def of filterDefinitions) {
      const v = filters[def.id]
      if (v !== undefined) {
        result.push({ definition: def, value: v })
      }
    }
    return result
  }, [filterDefinitions, filters])

  if (active.length === 0) {
    if (placement === 'block') {
      return null
    }
    return (
      <span
        aria-hidden
        className={cn(
          'hidden lg:inline-flex flex-1 min-w-0 justify-center',
          'truncate text-xs text-muted-foreground/70',
          'select-none pointer-events-none',
        )}
      >
        {KEYBOARD_HINT_TEXT}
      </span>
    )
  }

  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-1.5 overflow-x-auto touch-pan-x',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        'mask-[linear-gradient(to_right,black_calc(100%-1.5rem),transparent)]',
        placement === 'inline'
          ? 'hidden lg:flex flex-1'
          : 'flex min-h-7 lg:hidden',
      )}
    >
      <AnimatePresence initial={false}>
        {active.map(({ definition, value }) => (
          <motion.div
            key={definition.id}
            layout
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="shrink-0"
          >
            <FilterChip
              definition={definition}
              value={value}
              onClear={() => setFilter(definition.id, undefined)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
