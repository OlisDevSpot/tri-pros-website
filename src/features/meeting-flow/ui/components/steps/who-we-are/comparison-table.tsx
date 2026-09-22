import type { ComparisonRow } from '@/features/meeting-flow/types'
import { CheckIcon, XIcon } from 'lucide-react'
import { COMPARISON_COLUMNS } from '@/features/meeting-flow/constants/who-we-are-slides'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { cn } from '@/shared/lib/utils'

interface ComparisonTableProps {
  rows: ComparisonRow[]
}

/**
 * Tri Pros against other contractors, one topic per row. The Tri Pros column carries
 * a light band and accent checks; the other column recedes. Both comparison slides render
 * it the same way, at full size: each has a whole screen (C42).
 */
export function ComparisonTable({ rows }: ComparisonTableProps) {
  const cell = 'px-[1.4cqw] py-presentation-tight text-presentation-body'

  return (
    <Table className="table-fixed text-white">
      <colgroup>
        <col className="w-[26%]" />
        <col className="w-[39%]" />
        <col className="w-[35%]" />
      </colgroup>
      <TableHeader>
        <TableRow className="border-white/20 hover:bg-transparent">
          <TableHead className={cn(cell, 'h-auto')}>
            <span className="sr-only">Topic</span>
          </TableHead>
          <TableHead className={cn(cell, 'h-auto bg-white/[0.08] font-semibold text-white')}>{COMPARISON_COLUMNS.triPros}</TableHead>
          <TableHead className={cn(cell, 'h-auto font-normal text-white/60')}>{COMPARISON_COLUMNS.others}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(row => (
          <TableRow key={row.label} className="border-white/10 hover:bg-transparent">
            <TableHead className={cn(cell, 'h-auto align-top font-semibold break-words hyphens-auto whitespace-normal text-white/80')} scope="row">
              {row.label}
            </TableHead>
            <TableCell className={cn(cell, 'bg-white/[0.08] align-top whitespace-normal')}>
              <span className="flex items-start gap-[0.6em]">
                <CheckIcon aria-hidden className="mt-[0.2em] size-[1em] shrink-0 text-(--presentation-accent)" />
                <span>
                  <span className="sr-only">
                    {COMPARISON_COLUMNS.triPros}
                    :
                    {' '}
                  </span>
                  {row.triPros}
                </span>
              </span>
            </TableCell>
            <TableCell className={cn(cell, 'align-top whitespace-normal text-white/55')}>
              <span className="flex items-start gap-[0.6em]">
                <XIcon aria-hidden className="mt-[0.2em] size-[1em] shrink-0 text-white/35" />
                <span>
                  <span className="sr-only">
                    {COMPARISON_COLUMNS.others}
                    :
                    {' '}
                  </span>
                  {row.others}
                </span>
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
