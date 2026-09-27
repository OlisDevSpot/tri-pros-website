'use client'

import type { MeetingRow } from '@/shared/entities/meetings/lib/columns-registry'

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { useTRPC } from '@/trpc/helpers'

/**
 * The panel mounts only while its row is expanded, so mounting is the fetch trigger. The same query key
 * warms the customer profile modal.
 */
export function useMeetingRowPanelData(meeting: MeetingRow) {
  const trpc = useTRPC()
  const customerId = meeting.customerId ?? ''

  const profile = useQuery({
    ...trpc.customerPipelinesRouter.getCustomerProfile.queryOptions({ customerId }),
    enabled: !!meeting.customerId,
  })

  const proposals = useMemo(
    () => profile.data?.meetings.find(m => m.id === meeting.id)?.proposals ?? [],
    [profile.data, meeting.id],
  )

  return { profile, customer: profile.data?.customer ?? null, proposals }
}
