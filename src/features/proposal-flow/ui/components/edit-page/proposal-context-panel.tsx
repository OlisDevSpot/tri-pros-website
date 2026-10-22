'use client'

import type { ProposalContextTab } from '@/features/proposal-flow/types'
import type { MeetingOverviewCardData } from '@/shared/entities/meetings/components/overview-card'

import { skipToken, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { PROPOSAL_CONTEXT_CUSTOMER_HIDDEN, PROPOSAL_CONTEXT_MEETING_HIDDEN } from '@/features/proposal-flow/constants/proposal-context-actions'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { useAbility } from '@/shared/domains/permissions/client'
import { CustomerOverviewCard } from '@/shared/entities/customers/components/overview-card'
import { MeetingOverviewCard } from '@/shared/entities/meetings/components/overview-card'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

interface Props {
  customerId: string
  meetingId: string | null
  tab: ProposalContextTab
  onTabChange: (tab: ProposalContextTab) => void
}

export function ProposalContextPanel({ customerId, meetingId, tab, onTabChange }: Props) {
  const trpc = useTRPC()
  const ability = useAbility()
  const profile = useQuery(trpc.customerPipelinesRouter.getCustomerProfile.queryOptions({ customerId }))

  // The profile carries the lead source's id only, and the lookup is super-admin only: other roles never send a read the server refuses.
  const leadSourceId = profile.data?.customer.leadSourceId
  const leadSourceRead = useQuery(trpc.leadSourcesRouter.getById.queryOptions(
    leadSourceId && ability.can('manage', 'all') ? { id: leadSourceId } : skipToken,
  ))
  // The profile's meetings carry the owner's id but not the name the card's Owner part needs.
  const participants = useQuery(trpc.meetingsRouter.participants.getParticipants.queryOptions(
    meetingId ? { meetingId } : skipToken,
  ))

  const leadSource = useMemo(() => {
    const row = leadSourceRead.data
    return row ? { id: row.id, name: row.name, slug: row.slug, isActive: row.isActive } : null
  }, [leadSourceRead.data])

  const meeting = useMemo<MeetingOverviewCardData | null>(() => {
    const found = profile.data?.meetings.find(m => m.id === meetingId)
    if (!found) {
      return null
    }
    const owner = participants.data?.find(p => p.role === 'owner')
    return {
      ...found,
      ownerId: owner?.userId ?? found.ownerId,
      ownerName: owner?.userName ?? null,
      ownerImage: owner?.userImage ?? null,
    }
  }, [profile.data, meetingId, participants.data])

  if (profile.isPending) {
    return <Skeleton className="h-64 rounded-xl" />
  }
  if (profile.isError) {
    const unreachable = profile.error.data?.code === 'NOT_FOUND' || profile.error.data?.code === 'FORBIDDEN'
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">
          {unreachable ? 'This customer’s profile isn’t available to you.' : 'Couldn’t load the customer. Try again.'}
        </p>
        {!unreachable && (
          <Button type="button" variant="outline" size="sm" onClick={() => void profile.refetch()}>Retry</Button>
        )}
      </div>
    )
  }

  const { customer } = profile.data

  return (
    <Tabs value={tab} onValueChange={value => onTabChange(value === 'visit' ? 'visit' : 'customer')} className="gap-4">
      <TabsList className="w-full">
        <TabsTrigger value="customer">Customer</TabsTrigger>
        {meetingId && <TabsTrigger value="visit">In-home visit</TabsTrigger>}
      </TabsList>
      {/* Both panes share one cell, so the panel is as tall as the taller card on either tab. */}
      <div className="grid">
        <TabsContent
          value="customer"
          forceMount
          inert={tab !== 'customer'}
          className={cn('flex min-w-0 flex-col gap-3 [grid-area:1/1]', tab !== 'customer' && 'invisible')}
        >
          <p className="font-semibold">{customer.name}</p>
          <CustomerOverviewCard customer={customer} leadSource={leadSource}>
            <CustomerOverviewCard.Actions mode="toolbar" hide={PROPOSAL_CONTEXT_CUSTOMER_HIDDEN} />
            <CustomerOverviewCard.ContactActions />
            <CustomerOverviewCard.LeadSource />
            <CustomerOverviewCard.ProfileFields />
          </CustomerOverviewCard>
        </TabsContent>
        {meetingId && (
          <TabsContent
            value="visit"
            forceMount
            inert={tab !== 'visit'}
            className={cn('min-w-0 [grid-area:1/1]', tab !== 'visit' && 'invisible')}
          >
            {meeting
              ? (
                  <MeetingOverviewCard meeting={meeting} className="flex flex-col gap-3">
                    <MeetingOverviewCard.Header>
                      <p className="font-semibold">In-home visit</p>
                    </MeetingOverviewCard.Header>
                    <MeetingOverviewCard.Actions mode="toolbar" hide={PROPOSAL_CONTEXT_MEETING_HIDDEN} />
                    <MeetingOverviewCard.Fields fields={[
                      { field: 'scheduledDate', format: 'full' },
                      { field: 'type' },
                      { field: 'outcome', variant: 'badge' },
                    ]}
                    />
                    <MeetingOverviewCard.Owner showName />
                    <MeetingOverviewCard.Trades />
                    <MeetingOverviewCard.Proposals entityListVariant="flush" />
                  </MeetingOverviewCard>
                )
              : <p className="text-sm text-muted-foreground">This visit isn’t available to you.</p>}
          </TabsContent>
        )}
      </div>
    </Tabs>
  )
}
