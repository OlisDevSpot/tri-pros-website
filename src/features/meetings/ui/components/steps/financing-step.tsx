'use client'

import { InfoIcon } from 'lucide-react'
import { financingRows, iraQualifiers, packageSavingsNote } from '@/features/meetings/constants/step-content'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Separator } from '@/shared/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { cn } from '@/shared/lib/utils'

export function FinancingStep() {
  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b bg-muted/30 px-5 py-3">
          <CardTitle className="text-sm font-semibold">
            GreenSky Financing Options — 9.99% APR
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-5">Term</TableHead>
                <TableHead>Est. Monthly</TableHead>
                <TableHead className="hidden sm:table-cell">Best for</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {financingRows.map(row => (
                <TableRow className={cn(row.highlight && 'bg-primary/5')} key={row.term}>
                  <TableCell className="px-5">
                    <div className="flex flex-col gap-0.5">
                      <span className={cn('text-sm font-medium', row.highlight && 'text-primary')}>
                        {row.term}
                      </span>
                      {row.highlight && (
                        <Badge className="w-fit border-primary/30 text-[10px] text-primary/80" variant="outline">
                          Most popular
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={cn('text-sm font-bold', row.highlight && 'text-primary')}>
                      {row.monthly}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                    {row.note}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 rounded-xl border border-emerald-700/30 bg-emerald-950/40 px-4 py-3">
        <div className="mt-0.5 shrink-0">
          <div className="flex size-8 items-center justify-center rounded-full bg-emerald-900/60 text-emerald-300">
            <span className="text-sm font-black">30%</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-emerald-300">IRA Section 25C Tax Credit</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button className="size-5 text-muted-foreground hover:text-foreground" size="icon" variant="ghost">
                  <InfoIcon className="size-3.5" />
                  <span className="sr-only">IRA credit details</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 text-sm" side="top">
                <p className="mb-2 font-semibold">What qualifies for the 25C credit?</p>
                <ul className="flex flex-col gap-1.5 text-muted-foreground">
                  {iraQualifiers.map(q => (
                    <li key={q}>{`• ${q}`}</li>
                  ))}
                </ul>
                <Separator className="my-3" />
                <p className="text-xs text-muted-foreground">
                  Credit equals 30% of qualifying costs, up to $3,200/year. Applied at tax time — not an upfront discount.
                </p>
              </PopoverContent>
            </Popover>
          </div>
          <p className="text-xs text-muted-foreground">
            {`On a $12,000 insulation + HVAC project — that's `}
            <strong className="text-foreground">$3,600 back</strong>
            {' at tax time. Monthly payment drops accordingly.'}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border/40 bg-card/40 px-4 py-3 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">The </span>
        {packageSavingsNote}
      </div>
    </div>
  )
}
