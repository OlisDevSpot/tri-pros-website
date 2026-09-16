import type { PanelSection } from '@/features/meeting-flow/types'

export const SHELL_COPY = {
  backToMeetings: 'Meetings',
  noCustomer: 'No customer',
  viewCustomerProfile: 'View customer profile',
  stepsNavLabel: 'Meeting steps',
  openPanel: 'Open meeting panel',
  closePanel: 'Close meeting panel',
  panelLabel: 'Meeting panel',
  railLabel: 'Inspector',
  prevStep: 'Previous step',
  nextStep: 'Next step',
  stepCounter: (current: number, total: number) => `${current} / ${total}`,
  stepAnnouncement: (current: number, total: number, title: string) => `Step ${current} of ${total}: ${title}`,
  present: 'Present',
  exitPresent: 'Exit present mode',
  reschedule: 'Reschedule',
  viewInSchedule: 'View in schedule',
  when: 'When',
  type: 'Type',
  outcome: 'Outcome',
  keyboardHeading: 'Keyboard',
} as const

export const PANEL_SECTION_LABELS: Record<PanelSection, string> = {
  meeting: 'Meeting',
  project: 'Project',
  context: 'Context',
  persona: 'Persona',
}
