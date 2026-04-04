'use client'

import type { CustomerProfileProposal } from '@/features/customer-pipelines/types'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  CalendarIcon,
  FileTextIcon,
  HammerIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

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
  /** The proposal that triggered this modal (status changed to approved). */
  proposalId: string
  meetingId?: string
  /** Called with the proposalId that was selected at submission time (may differ from initial). */
  onSuccess?: (selectedProposalId: string) => void
  onCancel?: () => void
}

function buildDescriptionFromProposal(proposal: CustomerProfileProposal): string {
  const scopes: string[] = []
  for (const ts of proposal.sowSummary) {
    scopes.push(...ts.scopes)
  }
  return [...new Set(scopes)].join(', ')
}

export function CreateProjectForm({
  customerId,
  customerName,
  proposalId: initialProposalId,
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

  // Flatten all proposals across all meetings
  const allProposals = useMemo(() => {
    if (!profileQuery.data?.meetings) {
      return []
    }
    return profileQuery.data.meetings.flatMap(m => m.proposals)
  }, [profileQuery.data?.meetings])

  const [selectedProposalId, setSelectedProposalId] = useState(initialProposalId)
  const selectedProposal = allProposals.find(p => p.id === selectedProposalId)

  // Derive the meeting from the selected proposal
  const selectedMeeting = useMemo(() => {
    if (!profileQuery.data?.meetings || !selectedProposal?.meetingId) {
      return null
    }
    return profileQuery.data.meetings.find(m => m.id === selectedProposal.meetingId) ?? null
  }, [profileQuery.data?.meetings, selectedProposal?.meetingId])

  const activeMeetingId = selectedMeeting?.id ?? preselectedMeetingId ?? ''

  const [title, setTitle] = useState(`${customerName} - ${customer?.city ?? ''}`.trim())
  const [description, setDescription] = useState('')
  const [projectDuration, setProjectDuration] = useState('')
  const [descriptionAutoSet, setDescriptionAutoSet] = useState(false)

  // Auto-generate description when proposal changes
  useEffect(() => {
    if (selectedProposal && !descriptionAutoSet) {
      const autoDesc = buildDescriptionFromProposal(selectedProposal)
      if (autoDesc) {
        setDescription(autoDesc)
        setDescriptionAutoSet(true)
      }
    }
  }, [selectedProposalId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-update title when customer data loads
  useEffect(() => {
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
        onSuccess?.(selectedProposalId)
      },
    }),
  )

  const canSubmit = title.trim().length > 0
    && activeMeetingId.length > 0
    && selectedProposalId.length > 0
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

  return (
    <div className="w-full space-y-4">
      {/* ── Context: Customer + Meeting + Proposal ── */}
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

        {/* Meeting (derived from selected proposal) */}
        {selectedMeeting && (
          <>
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
            <Separator />
          </>
        )}

        {/* Proposal selector */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">
            Approved Proposal
          </Label>
          <Select
            value={selectedProposalId}
            onValueChange={(v) => {
              setSelectedProposalId(v)
              setDescriptionAutoSet(false)
            }}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select a proposal" />
            </SelectTrigger>
            <SelectContent>
              {allProposals.map((p) => {
                const label = p.label ?? format(new Date(p.createdAt), 'MMM d, yyyy')
                const value = p.value != null && p.value > 0 ? ` — ${formatAsDollars(p.value)}` : ''
                return (
                  <SelectItem key={p.id} value={p.id}>
                    {`${label}${value}`}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>

          {/* Selected proposal details */}
          {selectedProposal && (
            <div className="space-y-3 pt-1">
              {/* Price */}
              <div className="flex items-center gap-2">
                <FileTextIcon size={14} className="shrink-0 text-muted-foreground" />
                <span className="text-sm flex-1 min-w-0 truncate">
                  {selectedProposal.label ?? format(new Date(selectedProposal.createdAt), 'MMM d, yyyy')}
                </span>
                {selectedProposal.value != null && selectedProposal.value > 0 && (
                  <span className="text-base font-bold text-green-700 dark:text-green-400 shrink-0">
                    {formatAsDollars(selectedProposal.value)}
                  </span>
                )}
              </div>

              {/* Trades & Scopes */}
              {selectedProposal.sowSummary.length > 0 && (
                <div className="space-y-2">
                  {selectedProposal.sowSummary.map(ts => (
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
          )}
        </div>
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
