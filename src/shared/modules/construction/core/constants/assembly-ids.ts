export const ASSEMBLY_IDS = ['roof-attic', 'crawl-space', 'exterior-wall', 'windows', 'yard-ground', 'hvac-attic'] as const
export type AssemblyId = typeof ASSEMBLY_IDS[number]
