import type { TablePreferences } from '@/shared/components/data-table/schemas/table-preferences'

import {
  TABLE_PREFERENCES_COOKIE_MAX_AGE,
  TABLE_PREFERENCES_COOKIE_PATH,
  TABLE_PREFERENCES_COOKIE_PREFIX,
} from '@/shared/components/data-table/constants/table-preferences-cookie'

/** Writes one table's preferences; a table back on all defaults drops its cookie. */
export function writeTablePreferencesCookie(tableId: string, preferences: TablePreferences) {
  const name = `${TABLE_PREFERENCES_COOKIE_PREFIX}${tableId}`
  const isDefault = Object.values(preferences).every(value => value === undefined)
  const attributes = `path=${TABLE_PREFERENCES_COOKIE_PATH}; samesite=lax`
  document.cookie = isDefault
    ? `${name}=; ${attributes}; max-age=0`
    : `${name}=${encodeURIComponent(JSON.stringify(preferences))}; ${attributes}; max-age=${TABLE_PREFERENCES_COOKIE_MAX_AGE}`
}
