import { defineEntitySpec } from '@/shared/dal/server/lib/define-spec'
import { appSettings, insertAppSettingSchema, selectAppSettingSchema } from '@/shared/db/schema'
import { APP_SETTING } from './constants'
import { appSettingVisibility } from './visibility'

const updateAppSettingSchema = insertAppSettingSchema.partial()

export const appSettingSchemas = {
  insert: insertAppSettingSchema,
  update: updateAppSettingSchema,
}

export const appSettingServerSpec = defineEntitySpec({
  entityName: APP_SETTING,
  subject: APP_SETTING,
  conditionColumns: [],
  visibility: appSettingVisibility,
  table: appSettings,
  schemas: {
    insert: insertAppSettingSchema,
    update: updateAppSettingSchema,
    select: selectAppSettingSchema,
  },
  // Natural string PK — feature key (e.g., 'voip-in-house', 'voip-campaigns', 'compliance').
  primaryKey: 'feature',
})
