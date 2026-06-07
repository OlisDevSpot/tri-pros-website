'use client'

import { useQuery } from '@tanstack/react-query'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useTRPC } from '@/trpc/helpers'

export function ContactAttributesReadout() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.voipCampaignsRouter.listAttributes.queryOptions())
  const attributes = data ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Contact attributes</CardTitle>
        <CardDescription>
          CloudTalk merge-field bridge — verify lead_source / primary_trade / trades_interested are wired.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading
          ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            )
          : attributes.length === 0
            ? (
                <p className="text-sm text-muted-foreground">
                  No attributes synced yet. Run a resync above.
                </p>
              )
            : (
                <ul className="flex flex-col divide-y divide-border/60">
                  {attributes.map(attr => (
                    <li key={attr.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="font-medium text-foreground">{attr.ctTitle}</span>
                      <span className="font-mono text-xs text-muted-foreground">{attr.appKey}</span>
                    </li>
                  ))}
                </ul>
              )}
      </CardContent>
    </Card>
  )
}
