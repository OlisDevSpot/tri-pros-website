'use client'

import type { FilterValue } from '@/shared/dal/client/lib/types'

import { AnimatePresence, motion } from 'motion/react'
import { useMemo } from 'react'

import { KEYBOARD_HINT_TEXT, KEYBOARD_HINT_TEXT_WITHOUT_PAGING } from '@/shared/components/query-toolbar/constants/keyboard-hints'
import { useQueryToolbarContext } from '@/shared/components/query-toolbar/lib/context'
import { FilterChip } from '@/shared/components/query-toolbar/ui/filter-chip'
import { cn } from '@/shared/lib/utils'

interface ChipRailProps {
  /** `inline` is auto-injected by `<Bar>`; its empty state shows the keyboard hint so the bar never grows a second row. */
  placement?: 'inline' | 'block'
}

export function QueryToolbarChipRail({ placement = 'block' }: ChipRailProps) {
  const { query, filters } = useQueryToolbarContext()
  const { filters: values, setFilter } = query.filterSort
  const hint = query.window.kind === 'page' ? KEYBOARD_HINT_TEXT : KEYBOARD_HINT_TEXT_WITHOUT_PAGING

  // Hidden filters are included: a URL value still applies on the server, so it keeps a removable chip.
  const active = useMemo(() => filters.flatMap(({ definition }) => {
    const value = values[definition.id] as FilterValue
    return value === undefined ? [] : [{ definition, value }]
  }), [filters, values])

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
        {hint}
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
