import type { EntityServerSpec } from '@/shared/dal/server/types'
import { appSettings, insertAppSettingSchema, selectAppSettingSchema } from '@/shared/db/schema'
import { APP_SETTING } from './constants'
import { appSettingVisibility } from './visibility'

const updateAppSettingSchema = insertAppSettingSchema.partial()

export const appSettingSchemas = {
  insert: insertAppSettingSchema,
  update: updateAppSettingSchema,
}

export const appSettingServerSpec = {
  entityName: APP_SETTING,
  caslSubject: APP_SETTING,
  visibility: appSettingVisibility,
  table: appSettings,
  schemas: {
    insert: insertAppSettingSchema,
    update: updateAppSettingSchema,
    select: selectAppSettingSchema,
  },
  // Natural string PK — feature key (e.g., 'voip-in-house', 'voip-campaigns', 'compliance').
  // see ../DOCS.md#natural-pk-feature
  primaryKey: 'feature',
} satisfies EntityServerSpec<typeof appSettings>
