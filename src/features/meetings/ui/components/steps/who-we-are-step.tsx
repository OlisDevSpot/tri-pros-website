'use client'

import { DUE_DILIGENCE_ITEMS } from '@/features/meetings/constants/due-diligence'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent } from '@/shared/components/ui/card'
import { cn } from '@/shared/lib/utils'

interface WhoWeAreStepProps {
  className?: string
}

export function WhoWeAreStep({ className }: WhoWeAreStepProps) {
  return (
    <div className={cn('space-y-8', className)}>
      {/* Hero */}
      <div className="space-y-2 text-center">
        <p className="text-muted-foreground text-base">
          A successful project starts with due diligence
        </p>
        <p className="text-muted-foreground/70 text-sm italic">
          We&apos;re here to educate you, not sell you.
        </p>
      </div>

      {/* Credential badges */}
      <div className="flex flex-wrap justify-center gap-2">
        <Badge className="px-3 py-1 text-xs font-medium" variant="secondary">
          Licensed CA Contractor
        </Badge>
        <Badge className="px-3 py-1 text-xs font-medium" variant="secondary">
          $2M Insured
        </Badge>
        <Badge className="px-3 py-1 text-xs font-medium" variant="secondary">
          5-Year Warranty
        </Badge>
      </div>

      {/* Due diligence cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DUE_DILIGENCE_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <Card className="border-border/60 bg-card/50" key={item.title}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-semibold leading-tight">{item.title}</h3>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Closing truth */}
      <blockquote className="border-primary/30 bg-muted/40 rounded-lg border-l-4 px-6 py-4">
        <p className="text-foreground/80 text-sm leading-relaxed italic">
          &ldquo;A successful remodeling project is not always about the finishes and nice design —
          many times success boils down to communication, supervision, leadership, and
          accountability.&rdquo;
        </p>
      </blockquote>
    </div>
  )
}
