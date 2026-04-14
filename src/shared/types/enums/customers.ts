import type { customerAgeGroups } from '@/shared/constants/enums/customers'

export type CustomerAgeGroup = (typeof customerAgeGroups)[number]
