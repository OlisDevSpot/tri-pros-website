export const mediaPhases = ['uncategorized', 'before', 'during', 'after'] as const
export type MediaPhase = (typeof mediaPhases)[number]
