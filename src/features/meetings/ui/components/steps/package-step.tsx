'use client'

import { packageItems, packageStackingRows } from '@/features/meetings/constants/step-content'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/components/ui/accordion'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Separator } from '@/shared/components/ui/separator'
import { cn } from '@/shared/lib/utils'

export function PackageStep() {
  return (
    <div className="flex flex-col gap-4">
      <Accordion className="rounded-xl border border-border/50 bg-card/40 px-4" collapsible defaultValue="shingles" type="single">
        {packageItems.map(item => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex flex-1 items-center gap-3 pr-2">
                <item.Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-sm font-semibold">{item.trigger}</span>
                <Badge
                  className={cn('ml-auto shrink-0 text-xs font-bold', item.valueCls)}
                  variant="outline"
                >
                  {item.value}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <p className="pb-2 text-sm leading-relaxed text-foreground/80">{item.body}</p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <Card className="border-primary/30 bg-primary/5 py-4">
        <CardContent className="flex flex-col gap-3 px-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            What stacks on top
          </p>
          <div className="flex flex-col gap-2">
            {packageStackingRows.map(row => (
              <div className="flex items-baseline justify-between gap-2" key={row.label}>
                <div>
                  <span className="text-sm font-medium">{row.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{row.note}</span>
                </div>
                <span className="shrink-0 text-sm font-bold text-primary">{row.amount}</span>
              </div>
            ))}
          </div>
          <Separator className="my-1" />
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold">Combined package value</span>
            <span className="text-base font-black text-primary">$1,400 + credits</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
