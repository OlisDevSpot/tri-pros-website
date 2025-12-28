import { pgEnum } from 'drizzle-orm/pg-core'
import { constructionTypes, homeAreas, tradeLocations, variableDataTypes } from '@/shared/constants/enums'

export const constructionTypeEnum = pgEnum('construction_type', constructionTypes)
export const homeAreaEnum = pgEnum('home_area', homeAreas)
export const locationEnum = pgEnum('location', tradeLocations)

export const dataTypeEnum = pgEnum('data_type', variableDataTypes)
