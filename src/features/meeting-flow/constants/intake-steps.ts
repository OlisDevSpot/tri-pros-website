import {
  creditScoreRanges,
  householdTypes,
  outcomePriorities,
  priorContractorExperiences,
  sellPlans,
  triggerEvents,
  yearBuiltRanges,
  yearsInHomeRanges,
} from '@/shared/constants/enums/customers'
import {
  meetingDecisionMakersPresentOptions,
  meetingPainTypes,
} from '@/shared/constants/enums/meetings'

// Field IDs map 1:1 to columns on the target entity (customer profile-trio
// columns, epic #256/#259, or meeting.contextJSON keys).
// `entity` determines whether the field is saved to the meeting or the customer.

export const INTAKE_STEPS = [
  {
    description: 'Understand what is driving them to act and what pain they are trying to solve.',
    fields: [
      {
        entity: 'customer',
        id: 'mainPain',
        label: 'Primary pain point',
        options: meetingPainTypes,
        type: 'select',
      },
      {
        entity: 'customer',
        id: 'secondaryPain',
        label: 'Secondary pain point (if any)',
        options: meetingPainTypes,
        type: 'select',
      },
      {
        entity: 'customer',
        id: 'triggerEvent',
        label: 'What triggered this visit?',
        options: triggerEvents,
        type: 'select',
      },
      {
        entity: 'customer',
        id: 'outcomePriority',
        label: 'What matters most to them?',
        options: outcomePriorities,
        type: 'select',
      },
    ],
    id: 'pain-motivation',
    title: 'Pain & Motivation',
  },
  {
    description: 'Capture who is at the table and the household makeup. This shapes your entire approach.',
    fields: [
      {
        entity: 'meeting',
        id: 'decisionMakersPresent',
        label: 'Who is present today',
        options: meetingDecisionMakersPresentOptions,
        type: 'select',
      },
      {
        entity: 'customer',
        id: 'householdType',
        label: 'Household type',
        options: householdTypes,
        type: 'select',
      },
    ],
    id: 'household',
    title: 'Household Profile',
  },
  {
    description: 'How long have they been here, what is their plan, and what do we know about the home itself?',
    fields: [
      {
        entity: 'customer',
        id: 'timeInHome',
        label: 'Years in this home',
        options: yearsInHomeRanges,
        type: 'select',
      },
      {
        entity: 'customer',
        id: 'sellPlan',
        label: 'Planning to sell?',
        options: sellPlans,
        type: 'select',
      },
      {
        entity: 'customer',
        id: 'yearBuilt',
        label: 'Year home was built',
        options: yearBuiltRanges,
        type: 'select',
      },
      {
        entity: 'customer',
        id: 'hoa',
        label: 'HOA?',
        type: 'boolean',
      },
    ],
    id: 'home-situation',
    title: 'Home & Situation',
  },
  {
    description: 'Gauge their readiness, how competitive the situation is, and the strength of their commitment.',
    fields: [
      {
        entity: 'customer',
        id: 'numQuotesReceived',
        label: 'How many other quotes have they received?',
        min: 0,
        placeholder: '0',
        type: 'number',
      },
      {
        entity: 'customer',
        id: 'projectNecessityRating',
        label: 'How necessary is this project to them? (1–10)',
        max: 10,
        min: 1,
        type: 'rating',
      },
      {
        entity: 'customer',
        id: 'constructionOutlookFavorabilityRating',
        label: 'How favorable is their outlook on construction? (1–10)',
        max: 10,
        min: 1,
        type: 'rating',
      },
    ],
    id: 'decision-context',
    title: 'Decision Context',
  },
  {
    description: 'Understand their financial picture to tailor the financing conversation.',
    fields: [
      {
        entity: 'customer',
        id: 'creditScore',
        label: 'Estimated credit score range',
        options: creditScoreRanges,
        type: 'select',
      },
      {
        entity: 'customer',
        id: 'priorContractorExperience',
        label: 'Prior contractor experience',
        options: priorContractorExperiences,
        type: 'select',
      },
    ],
    id: 'financial',
    title: 'Financial Profile',
  },
]
