'use client'

import { Loader2 } from 'lucide-react'

export function EnvelopeStateDraftSyncing() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 p-4">
        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">
          Creating draft envelope in Zoho...
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {[0, 1].map(i => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-3">
            <div className="size-8 shrink-0 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-20 animate-pulse rounded bg-muted" />
              <div className="h-3 w-14 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
