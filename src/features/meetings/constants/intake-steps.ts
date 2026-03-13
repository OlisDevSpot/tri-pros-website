import type { IntakeStep } from '@/features/meetings/types'
import {
  meetingAgeGroups,
  meetingCreditScoreRanges,
  meetingDecisionMakersPresentOptions,
  meetingDecisionUrgencies,
  meetingFamilyStatuses,
  meetingHouseholdTypes,
  meetingOutcomePriorities,
  meetingPainTypes,
  meetingPriorContractorExperience,
  meetingSellPlans,
  meetingTriggerEvents,
  meetingYearBuiltRanges,
  meetingYearsInHome,
} from '@/shared/constants/enums'

// Field IDs map 1:1 to keys inside the JSONB section specified by jsonbKey.

export const INTAKE_STEPS: IntakeStep[] = [
  {
    description: 'Capture who is at the table and the household makeup. This shapes your entire approach.',
    fields: [
      {
        id: 'decisionMakersPresent',
        jsonbKey: 'situationObjectiveProfileJSON',
        label: 'Who is present today',
        options: meetingDecisionMakersPresentOptions,
        type: 'select',
      },
      {
        id: 'familyStatus',
        jsonbKey: 'situationObjectiveProfileJSON',
        label: 'Household type',
        options: meetingFamilyStatuses,
        type: 'select',
      },
      {
        id: 'ageGroup',
        jsonbKey: 'situationObjectiveProfileJSON',
        label: 'Homeowner age group',
        options: meetingAgeGroups,
        type: 'select',
      },
      {
        id: 'householdType',
        jsonbKey: 'situationObjectiveProfileJSON',
        label: 'Household type',
        options: meetingHouseholdTypes,
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
        id: 'timeInHome',
        jsonbKey: 'situationObjectiveProfileJSON',
        label: 'Years in this home',
        options: meetingYearsInHome,
        type: 'select',
      },
      {
        id: 'sellPlan',
        jsonbKey: 'homeownerSubjectiveProfileJSON',
        label: 'Planning to sell?',
        options: meetingSellPlans,
        type: 'select',
      },
      {
        id: 'yearBuilt',
        jsonbKey: 'propertyProfileJSON',
        label: 'Year home was built',
        options: meetingYearBuiltRanges,
        type: 'select',
      },
      {
        id: 'hoa',
        jsonbKey: 'propertyProfileJSON',
        label: 'HOA?',
        type: 'boolean',
      },
    ],
    id: 'home-situation',
    title: 'Home & Situation',
  },
  {
    description: 'Understand what is driving them to act and what pain they are trying to solve.',
    fields: [
      {
        id: 'mainPain',
        jsonbKey: 'homeownerSubjectiveProfileJSON',
        label: 'Primary pain point',
        options: meetingPainTypes,
        type: 'select',
      },
      {
        id: 'secondaryPain',
        jsonbKey: 'homeownerSubjectiveProfileJSON',
        label: 'Secondary pain point (if any)',
        options: meetingPainTypes,
        type: 'select',
      },
      {
        id: 'triggerEvent',
        jsonbKey: 'homeownerSubjectiveProfileJSON',
        label: 'What triggered this visit?',
        options: meetingTriggerEvents,
        type: 'select',
      },
      {
        id: 'outcomePriority',
        jsonbKey: 'homeownerSubjectiveProfileJSON',
        label: 'What matters most to them?',
        options: meetingOutcomePriorities,
        type: 'select',
      },
    ],
    id: 'pain-motivation',
    title: 'Pain & Motivation',
  },
  {
    description: 'Gauge their readiness, how competitive the situation is, and the strength of their commitment.',
    fields: [
      {
        id: 'numQuotesReceived',
        jsonbKey: 'financialProfileJSON',
        label: 'How many other quotes have they received?',
        min: 0,
        placeholder: '0',
        type: 'number',
      },
      {
        id: 'decisionUrgencyRating',
        jsonbKey: 'homeownerSubjectiveProfileJSON',
        label: 'Decision urgency',
        options: meetingDecisionUrgencies,
        type: 'select',
      },
      {
        id: 'projectNecessityRating',
        jsonbKey: 'homeownerSubjectiveProfileJSON',
        label: 'How necessary is this project to them? (1–10)',
        max: 10,
        min: 1,
        type: 'rating',
      },
      {
        id: 'constructionOutlookFavorabilityRating',
        jsonbKey: 'homeownerSubjectiveProfileJSON',
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
        id: 'creditScore',
        jsonbKey: 'financialProfileJSON',
        label: 'Estimated credit score range',
        options: meetingCreditScoreRanges,
        type: 'select',
      },
      {
        id: 'priorContractorExperience',
        jsonbKey: 'homeownerSubjectiveProfileJSON',
        label: 'Prior contractor experience',
        options: meetingPriorContractorExperience,
        type: 'select',
      },
    ],
    id: 'financial',
    title: 'Financial Profile',
  },
]
