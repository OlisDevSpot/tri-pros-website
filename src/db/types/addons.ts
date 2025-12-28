import type { addonsData } from '@/db/seeds/data/addons'

export type AddonAccessor = typeof addonsData[number]['accessor']
