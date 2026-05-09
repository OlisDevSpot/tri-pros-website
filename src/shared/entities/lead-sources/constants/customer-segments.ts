export const customerSegments = ['all', 'active', 'signed', 'dead'] as const

export type CustomerSegment = (typeof customerSegments)[number]
