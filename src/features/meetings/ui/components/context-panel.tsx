'use client'

import type { Customer, Meeting } from '@/shared/db/schema'
import { useCallback } from 'react'
import { ContextPanelSection } from '@/features/meetings/ui/components/context-panel-section'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/components/ui/sheet'
import {
  customerDemeanors,
  meetingCreditScoreRanges,
  meetingDecisionMakersPresentOptions,
  meetingDecisionTimelines,
  meetingHouseholdTypes,
  meetingOutcomePriorities,
  meetingOutcomes,
  meetingPriorContractorExperience,
  meetingSellPlans,
  meetingTriggerEvents,
  meetingYearBuiltRanges,
  meetingYearsInHome,
  observedBudgetComforts,
  spouseDynamics,
} from '@/shared/constants/enums'

interface ContextPanelProps {
  customer: Customer | null
  isOpen: boolean
  meeting: Meeting
  onContextChange: (patch: Record<string, unknown>) => void
  onCustomerProfileChange: (jsonbKey: string, patch: Record<string, unknown>) => void
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
  const customerProfile = (customer?.customerProfileJSON ?? {}) as Record<string, unknown>
  const propertyProfile = (customer?.propertyProfileJSON ?? {}) as Record<string, unknown>
  const financialProfile = (customer?.financialProfileJSON ?? {}) as Record<string, unknown>

  // Section 1 — Pre-Meeting (meeting.contextJSON)
  const handlePreMeetingChange = useCallback(
    (id: string, value: unknown) => {
      onContextChange({ [id]: value })
    },
    [onContextChange],
  )

  // Section 2 — Customer Profile (customer.customerProfileJSON)
  const handleCustomerProfileChange = useCallback(
    (id: string, value: unknown) => {
      onCustomerProfileChange('customerProfileJSON', { [id]: value })
    },
    [onCustomerProfileChange],
  )

  // Section 3 — Property (customer.propertyProfileJSON)
  const handlePropertyChange = useCallback(
    (id: string, value: unknown) => {
      onCustomerProfileChange('propertyProfileJSON', { [id]: value })
    },
    [onCustomerProfileChange],
  )

  // Section 4 — Financial (customer.financialProfileJSON)
  const handleFinancialChange = useCallback(
    (id: string, value: unknown) => {
      onCustomerProfileChange('financialProfileJSON', { [id]: value })
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
            fields={[
              {
                id: 'decisionMakersPresent',
                label: 'Decision Makers Present',
                options: meetingDecisionMakersPresentOptions,
                type: 'select',
              },
              {
                id: 'agentNotes',
                label: 'Agent Notes',
                placeholder: 'Internal notes…',
                type: 'textarea',
              },
            ]}
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
            fields={[
              {
                id: 'triggerEvent',
                label: 'Trigger Event',
                options: meetingTriggerEvents,
                type: 'select',
              },
              {
                id: 'outcomePriority',
                label: 'Outcome Priority',
                options: meetingOutcomePriorities,
                type: 'select',
              },
              {
                id: 'householdType',
                label: 'Household Type',
                options: meetingHouseholdTypes,
                type: 'select',
              },
              {
                id: 'timeInHome',
                label: 'Time in Home',
                options: meetingYearsInHome,
                type: 'select',
              },
              {
                id: 'sellPlan',
                label: 'Sell Plan',
                options: meetingSellPlans,
                type: 'select',
              },
              {
                id: 'priorContractorExperience',
                label: 'Prior Contractor Experience',
                options: meetingPriorContractorExperience,
                type: 'select',
              },
              {
                id: 'decisionTimeline',
                label: 'Decision Timeline',
                options: meetingDecisionTimelines,
                type: 'select',
              },
              {
                id: 'projectNecessityRating',
                label: 'Project Necessity (1–10)',
                max: 10,
                min: 1,
                type: 'number',
              },
              {
                id: 'constructionOutlookFavorabilityRating',
                label: 'Construction Outlook (1–10)',
                max: 10,
                min: 1,
                type: 'number',
              },
            ]}
            title="Customer Profile"
            values={customerProfile}
            onFieldChange={handleCustomerProfileChange}
          />

          {/* Section 3 — Property */}
          <ContextPanelSection
            defaultOpen={false}
            fields={[
              {
                id: 'yearBuilt',
                label: 'Year Built',
                options: meetingYearBuiltRanges,
                type: 'select',
              },
              {
                id: 'hoa',
                label: 'HOA',
                type: 'boolean',
              },
            ]}
            title="Property"
            values={propertyProfile}
            onFieldChange={handlePropertyChange}
          />

          {/* Section 4 — Financial */}
          <ContextPanelSection
            defaultOpen={false}
            fields={[
              {
                id: 'creditScore',
                label: 'Credit Score',
                options: meetingCreditScoreRanges,
                type: 'select',
              },
              {
                id: 'numQuotesReceived',
                label: '# Quotes Received',
                min: 0,
                type: 'number',
              },
            ]}
            title="Financial"
            values={financialProfile}
            onFieldChange={handleFinancialChange}
          />

          {/* Section 5 — Agent Observations */}
          <ContextPanelSection
            defaultOpen={false}
            fields={[
              {
                id: 'observedUrgency',
                label: 'Observed Urgency (1–10)',
                max: 10,
                min: 1,
                type: 'number',
              },
              {
                id: 'observedBudgetComfort',
                label: 'Budget Comfort',
                options: observedBudgetComforts,
                type: 'select',
              },
              {
                id: 'spouseDynamic',
                label: 'Spouse Dynamic',
                options: spouseDynamics,
                type: 'select',
              },
              {
                id: 'customerDemeanor',
                label: 'Customer Demeanor',
                options: customerDemeanors,
                type: 'select',
              },
            ]}
            title="Agent Observations"
            values={observationValues}
            onFieldChange={handleObservationsChange}
          />

          {/* Section 6 — Outcome */}
          <ContextPanelSection
            defaultOpen={false}
            fields={[
              {
                id: 'meetingOutcome',
                label: 'Meeting Outcome',
                options: meetingOutcomes,
                type: 'select',
              },
            ]}
            title="Outcome"
            values={outcomeValues}
            onFieldChange={handleOutcomeChange}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
