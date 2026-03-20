import type { leadSources, leadTypes } from '@/shared/constants/enums/leads'

export type LeadSource = (typeof leadSources)[number]
export type LeadType = (typeof leadTypes)[number]
