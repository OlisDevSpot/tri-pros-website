import type { materialsData } from '@/shared/db/seeds/data/materials'

export type MaterialAccessor = (typeof materialsData)[number]['accessor']
