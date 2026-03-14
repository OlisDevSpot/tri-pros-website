import type { TimePreset } from '@/shared/components/data-table/types'

import { endOfDay, endOfMonth, endOfWeek, startOfDay, startOfMonth, startOfWeek } from 'date-fns'

export const TIME_PRESET_TODAY: TimePreset = {
  label: 'Today',
  value: 'today',
  getRange: () => ({
    from: startOfDay(new Date()).toISOString(),
    to: endOfDay(new Date()).toISOString(),
  }),
}

export const TIME_PRESET_THIS_WEEK: TimePreset = {
  label: 'This Week',
  value: 'this-week',
  getRange: () => ({
    from: startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString(),
    to: endOfWeek(new Date(), { weekStartsOn: 1 }).toISOString(),
  }),
}

export const TIME_PRESET_THIS_MONTH: TimePreset = {
  label: 'This Month',
  value: 'this-month',
  getRange: () => ({
    from: startOfMonth(new Date()).toISOString(),
    to: endOfMonth(new Date()).toISOString(),
  }),
}

export const DEFAULT_TIME_PRESETS: readonly TimePreset[] = [
  TIME_PRESET_TODAY,
  TIME_PRESET_THIS_WEEK,
  TIME_PRESET_THIS_MONTH,
]
