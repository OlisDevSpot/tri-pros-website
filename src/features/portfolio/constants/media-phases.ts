export const MEDIA_PHASES = ['before', 'during', 'after', 'main'] as const

export type MediaPhase = (typeof MEDIA_PHASES)[number]
