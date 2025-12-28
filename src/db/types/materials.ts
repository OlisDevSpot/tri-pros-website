import type { materialsData } from '@/db/seeds/data/materials'

export type MaterialAccessor = (typeof materialsData)[number]['accessor']
