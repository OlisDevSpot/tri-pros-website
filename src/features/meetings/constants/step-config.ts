import type { MeetingStepConfig } from '@/features/meetings/types'

export const MEETING_STEPS: MeetingStepConfig[] = [
  {
    id: 'who-we-are',
    stepNumber: 1,
    title: 'Navigating the Construction Industry',
    shortLabel: 'Who We Are',
    isCustomerFacing: true,
  },
  {
    id: 'specialties',
    stepNumber: 2,
    title: 'Which Specialties Matter to You',
    shortLabel: 'Specialties',
    isCustomerFacing: true,
  },
  {
    id: 'portfolio',
    stepNumber: 3,
    title: 'Past References & Projects',
    shortLabel: 'Portfolio',
    isCustomerFacing: true,
  },
  {
    id: 'deal-structure',
    stepNumber: 4,
    title: 'Deal Structure',
    shortLabel: 'Deal',
    isCustomerFacing: false,
  },
  {
    id: 'program',
    stepNumber: 5,
    title: 'Picking the Right Path',
    shortLabel: 'Program',
    isCustomerFacing: true,
  },
  {
    id: 'closing',
    stepNumber: 6,
    title: 'Closing Summary',
    shortLabel: 'Close',
    isCustomerFacing: true,
  },
  {
    id: 'create-proposal',
    stepNumber: 7,
    title: 'Create Proposal',
    shortLabel: 'Proposal',
    isCustomerFacing: false,
  },
]

export const TOTAL_STEPS = MEETING_STEPS.length
