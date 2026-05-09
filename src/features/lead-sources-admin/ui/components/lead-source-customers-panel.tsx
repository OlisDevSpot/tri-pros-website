'use client'

import type { CustomerSegment } from '@/shared/entities/lead-sources/constants/customer-segments'

import { useQuery } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { parseAsStringEnum, useQueryState } from 'nuqs'

import { CustomerStatusSegments } from '@/features/lead-sources-admin/ui/components/customer-status-segments'
import { LeadSourceCustomersSection } from '@/features/lead-sources-admin/ui/components/lead-source-customers-section'
import { Button } from '@/shared/components/ui/button'
import { customerSegments } from '@/shared/entities/lead-sources/constants/customer-segments'
import { useTRPC } from '@/trpc/helpers'

interface LeadSourceCustomersPanelProps {
  leadSourceId: string
  onAddCustomer: () => void
}

export function LeadSourceCustomersPanel({ leadSourceId, onAddCustomer }: LeadSourceCustomersPanelProps) {
  const trpc = useTRPC()
  const [segment, setSegment] = useQueryState(
    'seg',
    parseAsStringEnum([...customerSegments]).withDefault('active'),
  )

  const countsQuery = useQuery(
    trpc.leadSourcesRouter.getStatusCounts.queryOptions({ id: leadSourceId }),
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <CustomerStatusSegments
          value={segment}
          counts={countsQuery.data}
          onChange={next => setSegment(next as CustomerSegment, { history: 'replace' })}
          isLoading={countsQuery.isLoading}
        />
        <Button
          size="sm"
          onClick={onAddCustomer}
          className="h-11 gap-1.5 sm:h-8"
        >
          <PlusIcon className="size-4" />
          Add customer
        </Button>
      </div>
      <LeadSourceCustomersSection leadSourceId={leadSourceId} segment={segment} />
    </div>
  )
}
