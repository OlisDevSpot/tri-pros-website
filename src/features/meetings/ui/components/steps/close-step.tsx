'use client'

import type { MeetingContext } from '@/features/meetings/types'
import { closeSummaryRows } from '@/features/meetings/constants/step-content'
import { getInstallSlotsLeft, getMonthEnd } from '@/features/meetings/lib/buy-triggers'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { cn } from '@/shared/lib/utils'

interface CloseStepProps {
  ctx: MeetingContext
}

export function CloseStep({ ctx }: CloseStepProps) {
  const firstName = ctx.customer?.name.split(' ')[0]
  const monthEnd = getMonthEnd()

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b bg-muted/20 px-5 py-3">
          <CardTitle className="text-sm font-semibold">
            {firstName ? `${firstName}'s Program Summary` : 'Program Summary'}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border/40 px-0 py-0">
          {closeSummaryRows.map(row => (
            <div className="flex items-start gap-3 px-5 py-3" key={row.id}>
              <row.Icon className={cn('mt-0.5 size-4 shrink-0', row.accent)} />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {row.label}
                </span>
                <span className="text-sm leading-snug text-foreground/90">{row.value}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-4 text-center">
        <p className="text-sm font-semibold text-foreground">
          {firstName
            ? `Ready, ${firstName}? The proposal takes 5 minutes.`
            : 'Ready? The proposal takes 5 minutes.'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Your name, address, scope confirmation, and financing preference. Our install coordinator calls within 24 hours to schedule your start date.
        </p>
        <div className="mt-3 flex items-center justify-center gap-2">
          <Badge className="border-primary/40 text-xs text-primary/80" variant="outline">
            {`Expires ${monthEnd}`}
          </Badge>
          <Badge className="border-amber-600/40 text-xs text-amber-400" variant="outline">
            {`${getInstallSlotsLeft()} slots remaining`}
          </Badge>
        </div>
      </div>
    </div>
  )
}
