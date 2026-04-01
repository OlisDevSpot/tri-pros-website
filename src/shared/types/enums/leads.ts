import type { intakeModes, leadSources, leadTypes } from '@/shared/constants/enums/leads'

export type IntakeMode = (typeof intakeModes)[number]
export type LeadSource = (typeof leadSources)[number]
export type LeadType = (typeof leadTypes)[number]
