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
      className="-ml-3"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      {Icon && <Icon className="mr-1.5 h-3.5 w-3.5" />}
      {label}
      <ArrowUpDownIcon className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
    </Button>
  )
}
