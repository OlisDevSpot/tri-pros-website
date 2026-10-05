import type { TablePreferences } from '@/shared/components/data-table/schemas/table-preferences'

const LEGACY_KEYS = {
  sizes: 'dt-col-sizes:',
  frozen: 'dt-frozen:',
  visibility: 'dt-col-visibility:',
} as const

/**
 * Moves the preferences a device saved to localStorage, before they moved to cookies, out of localStorage (removing
 * each key it reads). Delete once every device has loaded the dashboard since.
 */
export function takeLegacyTablePreferences(): Record<string, TablePreferences> {
  const byTable: Record<string, TablePreferences> = {}
  try {
    for (const key of Object.keys(localStorage)) {
      const field = (Object.keys(LEGACY_KEYS) as (keyof typeof LEGACY_KEYS)[]).find(f => key.startsWith(LEGACY_KEYS[f]))
      if (!field) {
        continue
      }
      const tableId = key.slice(LEGACY_KEYS[field].length)
      const raw = localStorage.getItem(key)
      localStorage.removeItem(key)
      try {
        const value: unknown = field === 'frozen' ? raw !== 'false' : JSON.parse(raw ?? 'null')
        if (value !== null) {
          byTable[tableId] = { ...byTable[tableId], [field]: value }
        }
      }
      catch { /* malformed; dropped */ }
    }
  }
  catch { /* localStorage unavailable */ }
  return byTable
}
