'use client'

import type { Meeting } from '@/shared/db/schema'
import type { CustomerWithProfile } from '@/shared/entities/customers/dal/server/queries'
import type { ProfileFieldConfig } from '@/shared/entities/customers/types'
import { useCallback } from 'react'
import { ContextPanelSection } from '@/features/meeting-flow/ui/components/context-panel-section'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/components/ui/sheet'
import {
  budgetComforts,
  demeanors,
  spouseDynamics,
} from '@/shared/constants/enums/customers'
import {
  meetingDecisionMakersPresentOptions,
  meetingOutcomes,
} from '@/shared/constants/enums/meetings'
import { CUSTOMER_PROFILE_FIELDS } from '@/shared/entities/customers/constants/customer-profile-fields'
import { FINANCIAL_PROFILE_FIELDS } from '@/shared/entities/customers/constants/financial-profile-fields'
import { PROPERTY_PROFILE_FIELDS } from '@/shared/entities/customers/constants/property-profile-fields'

// Meeting-specific field definitions (not customer profile fields)
const SITUATIONAL_FIELDS: ProfileFieldConfig[] = [
  {
    id: 'decisionMakersPresent',
    label: 'Decision Makers Present',
    options: meetingDecisionMakersPresentOptions,
    type: 'select',
  },
  {
    id: 'agentNotes',
    label: 'Agent Notes',
    placeholder: 'Internal notes...',
    type: 'textarea',
  },
]

const OBSERVATION_FIELDS: ProfileFieldConfig[] = [
  { id: 'observedUrgency', label: 'Observed Urgency (1-10)', type: 'number', min: 1, max: 10 },
  { id: 'observedBudgetComfort', label: 'Budget Comfort', type: 'select', options: budgetComforts },
  { id: 'spouseDynamic', label: 'Spouse Dynamic', type: 'select', options: spouseDynamics },
  { id: 'customerDemeanor', label: 'Customer Demeanor', type: 'select', options: demeanors },
]

const OUTCOME_FIELDS: ProfileFieldConfig[] = [
  { id: 'meetingOutcome', label: 'Meeting Outcome', type: 'select', options: meetingOutcomes },
]

interface ContextPanelProps {
  customer: CustomerWithProfile | null
  isOpen: boolean
  meeting: Meeting
  onContextChange: (patch: Record<string, unknown>) => void
  onCustomerProfileChange: (patch: Record<string, unknown>) => void
  onOutcomeChange: (outcome: string) => void
  onAgentNotesChange: (notes: string) => void
  onOpenChange: (open: boolean) => void
}

export function ContextPanel({
  customer,
  isOpen,
  meeting,
  onContextChange,
  onCustomerProfileChange,
  onOutcomeChange,
  onAgentNotesChange,
  onOpenChange,
}: ContextPanelProps) {
  const ctx = (meeting.contextJSON ?? {}) as Record<string, unknown>
  const customerRow = (customer ?? {}) as unknown as Record<string, unknown>

  // Section 1 — Pre-Meeting (meeting.contextJSON)
  const handlePreMeetingChange = useCallback(
    (id: string, value: unknown) => {
      onContextChange({ [id]: value })
    },
    [onContextChange],
  )

  // Sections 2-4 — Customer profile-trio columns (epic #256/#259). Each
  // section writes only the one changed field — no read-modify-merge, the
  // column IS the field.
  const handleCustomerProfileChange = useCallback(
    (id: string, value: unknown) => {
      onCustomerProfileChange({ [id]: value })
    },
    [onCustomerProfileChange],
  )

  // Section 5 — Agent Observations (meeting.contextJSON)
  const handleObservationsChange = useCallback(
    (id: string, value: unknown) => {
      onContextChange({ [id]: value })
    },
    [onContextChange],
  )

  // Section 6 — Outcome (meeting.meetingOutcome)
  const handleOutcomeChange = useCallback(
    (_id: string, value: unknown) => {
      if (typeof value === 'string') {
        onOutcomeChange(value)
      }
    },
    [onOutcomeChange],
  )

  // Agent notes is part of pre-meeting section for simplicity — write to agentNotes column
  const handleAgentNotesChange = useCallback(
    (_id: string, value: unknown) => {
      if (typeof value === 'string') {
        onAgentNotesChange(value)
      }
    },
    [onAgentNotesChange],
  )

  const situationalValues: Record<string, unknown> = {
    decisionMakersPresent: ctx.decisionMakersPresent,
    agentNotes: meeting.agentNotes ?? '',
  }

  const observationValues: Record<string, unknown> = {
    observedUrgency: ctx.observedUrgency,
    observedBudgetComfort: ctx.observedBudgetComfort,
    spouseDynamic: ctx.spouseDynamic,
    customerDemeanor: ctx.customerDemeanor,
  }

  const outcomeValues: Record<string, unknown> = {
    meetingOutcome: meeting.meetingOutcome,
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-80 flex-col gap-0 p-0 sm:max-w-80" side="left">
        <SheetHeader className="shrink-0 border-b px-4 py-3">
          <SheetTitle className="text-sm">Context Panel</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-2">
          {/* Section 1 — Situational */}
          <ContextPanelSection
            fields={SITUATIONAL_FIELDS}
            title="Situational"
            values={situationalValues}
            onFieldChange={(id, value) => {
              if (id === 'agentNotes') {
                handleAgentNotesChange(id, value)
              }
              else {
                handlePreMeetingChange(id, value)
              }
            }}
          />

          {/* Section 2 — Customer Profile */}
          <ContextPanelSection
            defaultOpen={false}
            fields={CUSTOMER_PROFILE_FIELDS}
            title="Customer Profile"
            values={customerRow}
            onFieldChange={handleCustomerProfileChange}
          />

          {/* Section 3 — Property */}
          <ContextPanelSection
            defaultOpen={false}
            fields={PROPERTY_PROFILE_FIELDS}
            title="Property"
            values={customerRow}
            onFieldChange={handleCustomerProfileChange}
          />

          {/* Section 4 — Financial */}
          <ContextPanelSection
            defaultOpen={false}
            fields={FINANCIAL_PROFILE_FIELDS}
            title="Financial"
            values={customerRow}
            onFieldChange={handleCustomerProfileChange}
          />

          {/* Section 5 — Agent Observations */}
          <ContextPanelSection
            defaultOpen={false}
            fields={OBSERVATION_FIELDS}
            title="Agent Observations"
            values={observationValues}
            onFieldChange={handleObservationsChange}
          />

          {/* Section 6 — Outcome */}
          <ContextPanelSection
            defaultOpen={false}
            fields={OUTCOME_FIELDS}
            title="Outcome"
            values={outcomeValues}
            onFieldChange={handleOutcomeChange}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
