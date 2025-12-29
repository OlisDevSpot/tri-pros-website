import { pgEnum } from 'drizzle-orm/pg-core'
import { constructionTypes, homeAreas, projectTypes, tradeLocations, variableDataTypes } from '@/shared/constants/enums'

export const projectTypeEnum = pgEnum('project_type', projectTypes)
export const constructionTypeEnum = pgEnum('construction_type', constructionTypes)
export const homeAreaEnum = pgEnum('home_area', homeAreas)
export const locationEnum = pgEnum('location', tradeLocations)

export const dataTypeEnum = pgEnum('data_type', variableDataTypes)
