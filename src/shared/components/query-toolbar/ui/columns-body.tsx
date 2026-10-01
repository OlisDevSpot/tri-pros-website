'use client'

import type { UseColumnVisibilityResult } from '@/shared/components/data-table/lib/use-column-visibility'

import { Checkbox } from '@/shared/components/ui/checkbox'
import { cn } from '@/shared/lib/utils'

interface ColumnsBodyProps {
  toggleableColumns: UseColumnVisibilityResult['toggleableColumns']
  hiddenCount: number
  onToggle: (id: string, visible: boolean) => void
  onReset: () => void
}

export function ColumnsBody({ toggleableColumns, hiddenCount, onToggle, onReset }: ColumnsBodyProps) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-foreground/10 px-4 py-2.5">
        <span className="text-xs font-semibold tracking-wide text-foreground">
          Columns
        </span>
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className={cn(
              'rounded text-xs text-muted-foreground transition-colors',
              'hover:text-foreground',
              'focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2',
            )}
          >
            Reset
          </button>
        )}
      </div>
      <ul className="flex flex-col py-1">
        {toggleableColumns.map(col => (
          <li key={col.id}>
            <label
              className={cn(
                'flex items-center gap-2.5 px-4 py-2 text-sm transition-colors',
                col.locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-foreground/5',
              )}
            >
              <Checkbox
                checked={col.visible}
                disabled={col.locked}
                onCheckedChange={checked => onToggle(col.id, checked === true)}
                aria-label={`Toggle ${col.displayName}`}
              />
              <span className="flex-1 text-foreground">{col.displayName}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
