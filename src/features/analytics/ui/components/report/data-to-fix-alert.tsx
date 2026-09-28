'use client'

import type { AnalyticsHygiene } from '@/features/analytics/types'

import { AlertTriangleIcon, ChevronDownIcon } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { HYGIENE_LABELS } from '@/features/analytics/constants/labels'
import { hygieneHref } from '@/features/analytics/lib/hygiene-links'
import { AnimatedCollapsibleContent, Collapsible, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import { formatAsCount } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

interface Props {
  keys: readonly (keyof AnalyticsHygiene)[]
  hygiene: AnalyticsHygiene
  asOf: string
}

/** One line until opened; hidden when nothing needs fixing. */
export function DataToFixAlert({ keys, hygiene, asOf }: Props) {
  const [open, setOpen] = useState(false)
  const items = keys.filter(key => hygiene[key] > 0)
  if (items.length === 0) {
    return null
  }
  const total = items.reduce((sum, key) => sum + hygiene[key], 0)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-warning/35 bg-warning/6">
      <CollapsibleTrigger className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <AlertTriangleIcon className="size-4 shrink-0 text-warning" aria-hidden="true" />
        <span className="font-semibold">
          {formatAsCount(total)}
          {' '}
          {total === 1 ? 'record' : 'records'}
          {' '}
          to fix
        </span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground max-sm:hidden">
          {items.map(key => `${formatAsCount(hygiene[key])} ${HYGIENE_LABELS[key].toLowerCase()}`).join(' · ')}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
          {open ? 'Hide' : 'Show'}
          <ChevronDownIcon className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </span>
      </CollapsibleTrigger>
      <AnimatedCollapsibleContent open={open}>
        <div className="flex flex-col gap-2 border-t border-warning/25 px-3 pt-2.5 pb-3">
          <ul className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-2.5 gap-y-2">
            {items.map((key) => {
              const href = hygieneHref(key, asOf)
              return (
                <li key={key} className="col-span-3 grid grid-cols-subgrid items-baseline text-sm">
                  <span className="text-right font-semibold tabular-nums">{formatAsCount(hygiene[key])}</span>
                  <span>{HYGIENE_LABELS[key]}</span>
                  {href
                    ? <Link href={href} className="font-semibold whitespace-nowrap text-primary underline-offset-4 hover:underline">Fix →</Link>
                    : <span className="text-xs text-muted-foreground">No list yet</span>}
                </li>
              )
            })}
          </ul>
          <p className="text-xs text-muted-foreground">All records, not narrowed by these filters.</p>
        </div>
      </AnimatedCollapsibleContent>
    </Collapsible>
  )
}
