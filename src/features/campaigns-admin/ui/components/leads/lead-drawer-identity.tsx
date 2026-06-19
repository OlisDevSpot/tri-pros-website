'use client'

import type { CampaignLeadRow } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'

import { useQuery } from '@tanstack/react-query'

import { formatLeadLocation } from '@/features/campaigns-admin/lib/format-lead-location'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { formatPhone } from '@/shared/lib/phone'
import { useTRPC } from '@/trpc/helpers'

export function LeadDrawerIdentity({ row }: { row: CampaignLeadRow }) {
  const trpc = useTRPC()
  const { data: customer, isLoading } = useQuery(
    trpc.customersRouter.crud.getById.queryOptions({ id: row.customerId }),
  )

  if (isLoading || !customer) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    )
  }

  const location = formatLeadLocation({
    address: customer.address,
    city: customer.city,
    state: customer.state,
    zip: customer.zip,
  })
  const trades = customer.leadMetaJSON?.interestedTradesRaw ?? []

  const rows: { label: string, value: string }[] = [
    { label: 'Phone', value: customer.phone ? formatPhone(customer.phone) : '—' },
    { label: 'Location', value: location.street ? `${location.street} · ${location.cityLine}` : location.cityLine },
    { label: 'Campaign', value: row.campaignName ?? '—' },
  ]

  return (
    <dl className="flex flex-col gap-2 text-sm">
      {rows.map(r => (
        <div className="flex justify-between gap-3" key={r.label}>
          <dt className="text-muted-foreground">{r.label}</dt>
          <dd className="text-right font-medium text-foreground">{r.value}</dd>
        </div>
      ))}
      {trades.length > 0 && (
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Trades</dt>
          <dd className="text-right font-medium text-foreground">{trades.join(', ')}</dd>
        </div>
      )}
    </dl>
  )
}
