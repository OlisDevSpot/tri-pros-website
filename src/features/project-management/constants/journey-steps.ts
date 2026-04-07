export const JOURNEY_STEPS = [
  { label: 'Design', description: 'Planning and design phase' },
  { label: 'Pre-Construction', description: 'Permits, materials, and preparation' },
  { label: 'Construction', description: 'Building the vision into reality' },
  { label: 'Completion', description: 'Final touches and handover' },
] as const

export type JourneyStep = (typeof JOURNEY_STEPS)[number]
