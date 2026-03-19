import type { StatBarItemConfig } from '@/shared/components/stat-bar/types'

import { SpinnerLoader } from '@/shared/components/loaders/spinner-loader'
import { cn } from '@/shared/lib/utils'

import { StatBarItem } from './stat-bar-item'

const LG_COLS_MAP: Record<number, string> = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
}

interface StatBarProps<T> {
  items: StatBarItemConfig<T>[]
  data: T[]
  isLoading?: boolean
  className?: string
}

export function StatBar<T>({ items, data, isLoading, className }: StatBarProps<T>) {
  if (isLoading) {
    return (
      <div className={cn('flex h-12 items-center', className)}>
        <SpinnerLoader />
      </div>
    )
  }

  return (
    <div className={cn('grid w-fit grid-cols-2 gap-1.5 lg:gap-3', LG_COLS_MAP[items.length] ?? 'lg:grid-cols-4', className)}>
      {items.map((item) => {
        const value = item.getValue(data)
        return (
          <StatBarItem
            key={item.key}
            icon={item.icon}
            label={item.label}
            value={value}
            displayValue={item.renderValue?.(value)}
            color={item.color}
          />
        )
      })}
    </div>
  )
}
