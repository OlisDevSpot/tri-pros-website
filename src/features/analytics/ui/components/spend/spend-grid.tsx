'use client'

import type { MissingSpend } from '@/features/analytics/lib/analytics-rules'

import { useQuery } from '@tanstack/react-query'
import { MoreHorizontalIcon } from 'lucide-react'

import { formatMonthLabel } from '@/features/analytics/lib/format-analytics'
import { spendGridRows } from '@/features/analytics/lib/spend-grid-rows'
import { ReportSkeleton } from '@/features/analytics/ui/components/report-skeleton'
import { SpendCell } from '@/features/analytics/ui/components/spend/spend-cell'
import { ErrorState } from '@/shared/components/states/error-state'
import { Button } from '@/shared/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { useLeadSourceActions } from '@/shared/entities/lead-sources/hooks/use-lead-source-actions'
import { useTRPC } from '@/trpc/helpers'

interface Props {
  months: string[] | undefined
  missing: MissingSpend[]
}

export function SpendGrid({ months, missing }: Props) {
  const trpc = useTRPC()
  const grid = useQuery({ ...trpc.leadSourcesRouter.spend.grid.queryOptions({ months: months ?? [] }), enabled: !!months?.length })
  const { setSpend, updateLeadSource } = useLeadSourceActions()

  if (!months?.length || grid.isPending) {
    return <ReportSkeleton />
  }
  if (grid.isError) {
    return (
      <ErrorState title="Spend didn't load" description="Nothing was changed. Try again.">
        <Button onClick={() => void grid.refetch()}>Retry</Button>
      </ErrorState>
    )
  }

  const missingKeys = new Set(missing.map(m => `${m.leadSourceId}|${m.month}`))
  const amounts = new Map(grid.data.entries.map(e => [`${e.leadSourceId}|${e.month}`, e.amountCents]))
  const { tracked, free } = spendGridRows(grid.data.sources, grid.data.entries, missing)

  return (
    <section aria-labelledby="spend" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="spend" className="text-lg font-medium">Monthly spend</h2>
        <p className="text-sm text-muted-foreground">Dollars per source per month; each cell saves when you leave it. Blank means not entered. A highlighted blank had leads that month.</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-background">Source</TableHead>
              {months.map(month => <TableHead key={month} className="text-right">{formatMonthLabel(month, 'short')}</TableHead>)}
              <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tracked.map(source => (
              <TableRow key={source.id}>
                <TableCell className="sticky left-0 z-10 max-w-48 truncate bg-background font-medium">
                  {source.name}
                  {source.archived && <span className="font-normal text-muted-foreground"> (archived)</span>}
                </TableCell>
                {months.map((month) => {
                  const key = `${source.id}|${month}`
                  const amount = amounts.get(key) ?? null
                  return (
                    <TableCell key={month} className="p-1">
                      {/* Keyed on the saved amount so a refetch resets the field to what the server holds. */}
                      <SpendCell
                        key={`${key}|${amount ?? ''}`}
                        sourceName={source.name}
                        month={month}
                        amountCents={amount}
                        missing={missingKeys.has(key)}
                        onSave={(amountCents, done) => setSpend.mutate({ leadSourceId: source.id, month, amountCents }, { onSettled: done })}
                      />
                    </TableCell>
                  )
                })}
                <TableCell className="p-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8" aria-label={`${source.name} spend options`}>
                        <MoreHorizontalIcon className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => updateLeadSource.mutate({ id: source.id, spendMode: 'none' })}>Mark as free (no spend)</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {free.length > 0 && (
        <div className="flex flex-col gap-2">
          <div>
            <h3 className="text-sm font-semibold">Free sources</h3>
            <p className="text-xs text-muted-foreground">No spend, and never flagged as missing.</p>
          </div>
          <ul className="flex flex-wrap gap-2">
            {free.map(source => (
              <li key={source.id}>
                <Button variant="outline" size="sm" onClick={() => updateLeadSource.mutate({ id: source.id, spendMode: 'manual' })}>
                  {source.name}
                  <span className="text-muted-foreground"> · Track spend</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
