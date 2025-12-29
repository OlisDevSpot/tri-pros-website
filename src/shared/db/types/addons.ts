import type { addonsData } from '@/shared/db/seeds/data/addons'

export type AddonAccessor = typeof addonsData[number]['accessor']
