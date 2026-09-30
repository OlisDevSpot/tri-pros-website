import type { TablePreferences } from '@/shared/components/data-table/schemas/table-preferences'

import { TABLE_PREFERENCES_COOKIE_PREFIX } from '@/shared/components/data-table/constants/table-preferences-cookie'
import { tablePreferencesSchema } from '@/shared/components/data-table/schemas/table-preferences'

/** Every table's saved preferences from the request's cookies, keyed by table id. A malformed cookie reads as none. */
export function readTablePreferences(cookies: readonly { name: string, value: string }[]): Record<string, TablePreferences> {
  const byTable: Record<string, TablePreferences> = {}
  for (const { name, value } of cookies) {
    if (!name.startsWith(TABLE_PREFERENCES_COOKIE_PREFIX)) {
      continue
    }
    try {
      const parsed = tablePreferencesSchema.safeParse(JSON.parse(decodeURIComponent(value)))
      if (parsed.success) {
        byTable[name.slice(TABLE_PREFERENCES_COOKIE_PREFIX.length)] = parsed.data
      }
    }
    catch { /* not JSON */ }
  }
  return byTable
}
