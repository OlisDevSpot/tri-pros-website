'use client'

import type { StatBarItemConfig } from '@/shared/components/stat-bar/types'

import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'

import { cn } from '@/shared/lib/utils'

import { StatBarItem } from './stat-bar-item'

interface StatBarProps<T> {
  items: StatBarItemConfig<T>[]
  data: T[]
  isLoading?: boolean
  className?: string
}

export function StatBar<T>({ items, data, isLoading, className }: StatBarProps<T>) {
  const [expanded, setExpanded] = useState(false)

  const computedItems = items.map(item => ({
    ...item,
    computedValue: isLoading ? 0 : item.getValue(data),
  }))

  return (
    <div className={className}>
      {/* Mobile — collapsible */}
      <div className="lg:hidden">
        {/* Collapsed: single row of badges */}
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg border border-border/50 px-3 py-2 transition-colors hover:bg-accent/50"
          onClick={() => setExpanded(prev => !prev)}
        >
          {computedItems.map(item => (
            <div key={item.key} className="flex items-center gap-1.5">
              <item.icon size={14} className={cn('text-muted-foreground', item.color)} />
              <span className="text-sm font-semibold tabular-nums">
                {isLoading ? '–' : (item.renderValue?.(item.computedValue) ?? item.computedValue)}
              </span>
            </div>
          ))}
          <motion.div
            className="ml-auto"
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" className="text-muted-foreground">
              <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </motion.div>
        </button>

        {/* Expanded: full 2x2 card grid */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-1.5 pt-2">
                {computedItems.map(item => (
                  <StatBarItem
                    key={item.key}
                    icon={item.icon}
                    label={item.label}
                    value={item.computedValue}
                    displayValue={item.renderValue?.(item.computedValue)}
                    color={item.color}
                    isLoading={isLoading}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop — always visible grid */}
      <div className="hidden lg:grid lg:grid-cols-4 lg:gap-3">
        {computedItems.map(item => (
          <StatBarItem
            key={item.key}
            icon={item.icon}
            label={item.label}
            value={item.computedValue}
            displayValue={item.renderValue?.(item.computedValue)}
            color={item.color}
            isLoading={isLoading}
          />
        ))}
      </div>
    </div>
  )
}
