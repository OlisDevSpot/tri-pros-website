import type { MeetingStepId, MeetingStepLayout } from '@/features/meeting-flow/types'

export interface MeetingStepConfig {
  id: MeetingStepId
  stepNumber: number
  title: string
  /** One line under the title where the step is introduced: the meeting splash's caption (E6, S18). */
  subheading?: string
  shortLabel: string
  isCustomerFacing: boolean
  layout: MeetingStepLayout
}

export const MEETING_STEPS: MeetingStepConfig[] = [
  {
    id: 'who-we-are',
    stepNumber: 1,
    title: 'Navigating the Construction Industry',
    subheading: 'What a legitimate project actually requires.',
    shortLabel: 'Who We Are',
    isCustomerFacing: true,
    layout: 'presentation',
  },
  {
    id: 'specialties',
    stepNumber: 2,
    title: 'Which Specialties Matter to You',
    shortLabel: 'Specialties',
    isCustomerFacing: true,
    layout: 'split',
  },
  {
    id: 'portfolio',
    stepNumber: 3,
    title: 'Past References & Projects',
    shortLabel: 'Portfolio',
    isCustomerFacing: true,
    layout: 'presentation',
  },
  {
    id: 'deal-structure',
    stepNumber: 4,
    title: 'Deal Structure',
    shortLabel: 'Deal',
    isCustomerFacing: false,
    layout: 'page',
  },
  {
    id: 'program',
    stepNumber: 5,
    title: 'Picking the Right Path',
    shortLabel: 'Program',
    isCustomerFacing: true,
    layout: 'page',
  },
  {
    id: 'closing',
    stepNumber: 6,
    title: 'Closing Summary',
    shortLabel: 'Close',
    isCustomerFacing: true,
    layout: 'page',
  },
  {
    id: 'create-proposal',
    stepNumber: 7,
    title: 'Create Proposal',
    shortLabel: 'Proposal',
    isCustomerFacing: false,
    layout: 'page',
  },
]

export const TOTAL_STEPS = MEETING_STEPS.length
