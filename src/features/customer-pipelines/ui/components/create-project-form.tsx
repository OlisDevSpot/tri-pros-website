'use client'

import type { CustomerProfileMeeting } from '@/features/customer-pipelines/types'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  CalendarIcon,
  FileTextIcon,
  HammerIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { AddressAction } from '@/shared/components/contact-actions/ui/address-action'
import { EmailAction } from '@/shared/components/contact-actions/ui/email-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Separator } from '@/shared/components/ui/separator'
import { Textarea } from '@/shared/components/ui/textarea'
import { formatAddress, formatAsDollars } from '@/shared/lib/formatters'
import { useTRPC } from '@/trpc/helpers'

interface CreateProjectFormProps {
  customerId: string
  customerName: string
  meetingId?: string
  onSuccess?: () => void
  onCancel?: () => void
}

function buildDescriptionFromMeeting(meeting: CustomerProfileMeeting): string {
  const scopes: string[] = []
  for (const p of meeting.proposals) {
    for (const ts of p.sowSummary) {
      scopes.push(...ts.scopes)
    }
  }
  return [...new Set(scopes)].join(', ')
}

export function CreateProjectForm({
  customerId,
  customerName,
  meetingId: preselectedMeetingId,
  onCancel,
  onSuccess,
}: CreateProjectFormProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const profileQuery = useQuery(
    trpc.customerPipelinesRouter.getCustomerProfile.queryOptions({ customerId }),
  )

  const customer = profileQuery.data?.customer
  const meetingsWithProposals = useMemo(() => {
    if (!profileQuery.data?.meetings) {
      return []
    }
    return profileQuery.data.meetings.filter(m => m.proposals.length > 0)
  }, [profileQuery.data?.meetings])

  const [title, setTitle] = useState(`${customerName} - ${customer?.city ?? ''}`.trim())
  const [selectedMeetingId, setSelectedMeetingId] = useState(preselectedMeetingId ?? '')
  const [description, setDescription] = useState('')
  const [projectDuration, setProjectDuration] = useState('')
  const [descriptionAutoSet, setDescriptionAutoSet] = useState(false)

  const activeMeetingId = preselectedMeetingId ?? selectedMeetingId
  const selectedMeeting = meetingsWithProposals.find(m => m.id === activeMeetingId)

  // Auto-generate description when meeting changes
  useMemo(() => {
    if (selectedMeeting && !descriptionAutoSet) {
      const autoDesc = buildDescriptionFromMeeting(selectedMeeting)
      if (autoDesc) {
        setDescription(autoDesc)
        setDescriptionAutoSet(true)
      }
    }
  }, [activeMeetingId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-update title when customer data loads
  useMemo(() => {
    if (customer?.city && title === `${customerName} -`) {
      setTitle(`${customerName} - ${customer.city}`)
    }
  }, [customer?.city]) // eslint-disable-line react-hooks/exhaustive-deps

  const createMutation = useMutation(
    trpc.projectsRouter.createBusinessProject.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.customerPipelinesRouter.getCustomerPipelineItems.queryFilter(),
        )
        await queryClient.invalidateQueries(
          trpc.customerPipelinesRouter.getCustomerProfile.queryFilter(),
        )
        await queryClient.invalidateQueries(
          trpc.meetingsRouter.getAll.queryFilter(),
        )
        onSuccess?.()
      },
    }),
  )

  const canSubmit = title.trim().length > 0
    && activeMeetingId.length > 0
    && !createMutation.isPending

  function handleSubmit() {
    if (!canSubmit) {
      return
    }
    createMutation.mutate({
      title: title.trim(),
      customerId,
      meetingId: activeMeetingId,
      description: description.trim() || null,
      projectDuration: projectDuration.trim() || null,
    })
  }

  // Find the approved proposal (or most recent one as fallback for display)
  const approvedProposal = selectedMeeting?.proposals.find(p => p.status === 'approved')
    ?? selectedMeeting?.proposals[0]

  return (
    <div className="w-full space-y-4">
      {/* ── Context: Customer + Meeting + Approved Proposal ── */}
      <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
        {/* Customer */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Customer</span>
          <p className="text-sm font-medium">{customerName}</p>
          <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            {customer?.phone && <PhoneAction phone={customer.phone} className="text-xs" />}
            {customer?.email && <EmailAction email={customer.email} className="text-xs" />}
            {customer?.address && (
              <AddressAction
                address={formatAddress(customer.address, customer.city, customer.state ?? 'CA', customer.zip)}
                className="text-xs"
              />
            )}
          </div>
        </div>

        <Separator />

        {/* Meeting */}
        {preselectedMeetingId && selectedMeeting
          ? (
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Meeting</span>
                <div className="flex items-center gap-2 text-sm">
                  <CalendarIcon size={14} className="shrink-0 text-muted-foreground" />
                  <span>
                    {selectedMeeting.scheduledFor
                      ? format(new Date(selectedMeeting.scheduledFor), 'EEE, MMM d, yyyy · h:mm a')
                      : format(new Date(selectedMeeting.createdAt), 'EEE, MMM d, yyyy')}
                  </span>
                </div>
              </div>
            )
          : (
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Meeting
                  {' '}
                  <span className="text-destructive">*</span>
                </Label>
                <Select value={selectedMeetingId} onValueChange={setSelectedMeetingId}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select a meeting with proposals" />
                  </SelectTrigger>
                  <SelectContent>
                    {meetingsWithProposals.map((m) => {
                      const date = m.scheduledFor
                        ? format(new Date(m.scheduledFor), 'MMM d, yyyy')
                        : format(new Date(m.createdAt), 'MMM d, yyyy')
                      return (
                        <SelectItem key={m.id} value={m.id}>
                          {`${date} — ${m.proposals.length} proposal${m.proposals.length !== 1 ? 's' : ''}`}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                {meetingsWithProposals.length === 0 && !profileQuery.isLoading && (
                  <p className="text-muted-foreground text-xs">
                    No meetings with proposals found.
                  </p>
                )}
              </div>
            )}

        {/* Approved Proposal */}
        {approvedProposal && (
          <>
            <Separator />
            <div className="space-y-3">
              <span className="text-xs font-medium text-muted-foreground">Approved Proposal</span>

              {/* Proposal label + price (prominent) */}
              <div className="flex items-center gap-2">
                <FileTextIcon size={14} className="shrink-0 text-muted-foreground" />
                <span className="text-sm flex-1 min-w-0 truncate">
                  {approvedProposal.label ?? format(new Date(approvedProposal.createdAt), 'MMM d, yyyy')}
                </span>
                {approvedProposal.value != null && approvedProposal.value > 0 && (
                  <span className="text-base font-bold text-green-700 dark:text-green-400 shrink-0">
                    {formatAsDollars(approvedProposal.value)}
                  </span>
                )}
              </div>

              {/* Trades & Scopes */}
              {approvedProposal.sowSummary.length > 0 && (
                <div className="space-y-2">
                  {approvedProposal.sowSummary.map(ts => (
                    <div key={ts.trade} className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium">
                        <HammerIcon size={11} className="shrink-0 text-muted-foreground" />
                        {ts.trade}
                      </div>
                      {ts.scopes.length > 0 && (
                        <div className="flex flex-wrap gap-1 pl-4">
                          {ts.scopes.map(scope => (
                            <Badge key={scope} variant="outline" className="text-[10px] font-normal">
                              {scope}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Editable Fields ── */}

      {/* Title */}
      <div className="space-y-2">
        <Label>
          Project title
          {' '}
          <span className="text-destructive">*</span>
        </Label>
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g., Smith Family - Temecula"
          maxLength={80}
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label>
          Description
          {' '}
          <span className="text-muted-foreground text-xs font-normal">(optional)</span>
        </Label>
        <Textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value)
            setDescriptionAutoSet(true)
          }}
          placeholder="Brief project description"
          maxLength={500}
          rows={2}
        />
      </div>

      {/* Duration */}
      <div className="space-y-2">
        <Label>
          Estimated duration
          {' '}
          <span className="text-muted-foreground text-xs font-normal">(optional)</span>
        </Label>
        <Input
          value={projectDuration}
          onChange={e => setProjectDuration(e.target.value)}
          placeholder="e.g., 2-3 weeks"
          maxLength={40}
        />
      </div>

      {/* Error */}
      {createMutation.isError && (
        <p className="text-destructive text-sm">
          {createMutation.error.message}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        <Button
          className="flex-1"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {createMutation.isPending ? 'Creating...' : 'Create project'}
        </Button>
      </div>
    </div>
  )
}
