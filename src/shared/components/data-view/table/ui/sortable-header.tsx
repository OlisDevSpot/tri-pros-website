import type { Column } from '@tanstack/react-table'
import type { LucideIcon } from 'lucide-react'

import { ArrowUpDownIcon } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'

interface Props {
  column: Column<any, unknown>
  label: string
  icon?: LucideIcon
}

export function SortableHeader({ column, label, icon: Icon }: Props) {
  return (
    <Button
      variant="ghost"
      size="sm"
      // Geometry tuned against TableHead's `px-2`:
      //   button-left = cellPad(8) - 6 = +2 (2px inset from column edge — no bleed)
      //   text-left   = button-left + 8 = +10 (≈ matches non-sortable header text at +8)
      // `has-[>svg]:px-2` overrides Button's default `px-2.5` so both icon and
      // non-icon variants share the same internal padding.
      className="-ml-1.5 h-7 px-2 has-[>svg]:px-2"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      {Icon && <Icon className="mr-1.5 h-3.5 w-3.5" />}
      {label}
      <ArrowUpDownIcon className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
    </Button>
  )
}
