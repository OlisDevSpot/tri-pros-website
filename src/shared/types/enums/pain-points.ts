import type { painPointCategories, painPointEmotionalDrivers, painPointSeverities, painPointUrgencies } from '@/shared/constants/enums/pain-points'

export type PainPointSeverity = (typeof painPointSeverities)[number]
export type PainPointUrgency = (typeof painPointUrgencies)[number]
export type PainPointEmotionalDriver = (typeof painPointEmotionalDrivers)[number]
export type PainPointCategory = (typeof painPointCategories)[number]
