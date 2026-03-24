'use client'

import type { CustomerProfileMeeting } from '@/features/customer-pipelines/types'

import { useMutation } from '@tanstack/react-query'
import { format } from 'date-fns'
import { PlusIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { useSession } from '@/shared/auth/client'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { ROOTS } from '@/shared/config/roots'
import { useAbility } from '@/shared/permissions/hooks'
import { useTRPC } from '@/trpc/helpers'

interface Props {
  meetings: CustomerProfileMeeting[]
}

export function CreateProposalPopover({ meetings }: Props) {
  const ability = useAbility()
  const trpc = useTRPC()
  const router = useRouter()
  const { data: session } = useSession()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>('')

  const createMutation = useMutation(
    trpc.proposalsRouter.createProposal.mutationOptions({
      onSuccess: ({ proposal }) => {
        setPopoverOpen(false)
        setSelectedMeetingId('')
        router.push(`${ROOTS.dashboard.root}?step=edit-proposal&proposalId=${proposal.id}`)
      },
      onError: () => {
        toast.error('Failed to create proposal')
      },
    }),
  )

  function handleCreate() {
    if (!selectedMeetingId || !session?.user?.id) {
      return
    }

    createMutation.mutate({
      meetingId: selectedMeetingId,
      ownerId: session.user.id,
      label: '',
      status: 'draft',
      formMetaJSON: { pricingMode: 'total' },
      projectJSON: {
        data: {
          label: '',
          type: 'general-remodeling',
          timeAllocated: '',
          validThroughTimeframe: '60 days',
          projectObjectives: [],
          homeAreasUpgrades: [],
          sow: [{ contentJSON: '', html: '', scopes: [], title: '', trade: { id: '', label: '' } }],
        },
        meta: { enabled: true },
      },
      fundingJSON: {
        data: {
          cashInDeal: 0,
          depositAmount: 0,
          finalTcp: 0,
          startingTcp: 0,
          incentives: [],
        },
        meta: { enabled: true, showPricingBreakdown: false },
      },
    })
  }

  function formatMeetingOption(meeting: CustomerProfileMeeting) {
    const type = meeting.type ?? 'Meeting'
    const program = meeting.program ?? 'No program'
    const date = meeting.scheduledFor
      ? format(new Date(meeting.scheduledFor), 'MMM d, yyyy')
      : 'No date'

    return `${type} — ${program} — ${date} (${meeting.status})`
  }

  if (!ability.can('create', 'Proposal')) {
    return null
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <PlusIcon className="h-3.5 w-3.5 mr-1" />
          New Proposal
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Create Proposal</p>
            <p className="text-xs text-muted-foreground mt-0.5">Select a meeting to link this proposal to.</p>
          </div>

          {meetings.length === 0
            ? (
                <p className="text-sm text-muted-foreground">
                  No meetings available. Create a meeting first.
                </p>
              )
            : (
                <>
                  <Select value={selectedMeetingId} onValueChange={setSelectedMeetingId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a meeting…" />
                    </SelectTrigger>
                    <SelectContent>
                      {meetings.map(meeting => (
                        <SelectItem key={meeting.id} value={meeting.id}>
                          {formatMeetingOption(meeting)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedMeetingId && (
                    <Button
                      className="w-full"
                      size="sm"
                      disabled={createMutation.isPending}
                      onClick={handleCreate}
                    >
                      {createMutation.isPending ? 'Creating…' : 'Create Proposal'}
                    </Button>
                  )}
                </>
              )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
