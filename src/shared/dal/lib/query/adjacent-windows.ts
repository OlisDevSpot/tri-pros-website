import type { CalendarViewType } from '@/shared/constants/enums'
import type { DataViewQueryConfig, DataViewWindowState } from '@/shared/dal/lib/query/data-view-query-config'
import type { FieldList } from '@/shared/dal/lib/query/field-list'

import { ADJACENT_WINDOW_RADIUS, MAX_PAGE } from '@/shared/dal/lib/query/constants'
import { dataViewUrlKeys, deriveDataViewWindow } from '@/shared/dal/lib/query/derive-data-view-input'
import { addCalendarDays } from '@/shared/lib/business-time'

function stepAnchor(anchor: string, view: CalendarViewType, step: number): string {
  switch (view) {
    case 'today':
      return addCalendarDays(anchor, step)
    case 'week':
      return addCalendarDays(anchor, 7 * step)
    case 'month': {
      // Any day of a month derives the same month grid, so its 1st stands in for it; stepping the 31st would skip short months.
      const [year, month] = anchor.split('-').map(Number)
      return new Date(Date.UTC(year, month - 1 + step, 1)).toISOString().slice(0, 10)
    }
  }
}

/** `-1, +1, -2, +2, …` out to `radius`: nearest first, so the likeliest next windows are requested first. */
function stepsWithin(radius: number): number[] {
  return Array.from({ length: radius }, (_, i) => [-(i + 1), i + 1]).flat()
}

/**
 * The windows around the current one, nearest first: pages within `ADJACENT_WINDOW_RADIUS.page`, or days, weeks
 * or months within `ADJACENT_WINDOW_RADIUS.date`. Each is derived from URL state the way navigating there would
 * write it, so a prefetched window's read input is the one the view asks for on arrival. A whole-list view has none.
 */
export function adjacentDataViewWindows<F extends FieldList>(urlState: Record<string, unknown>, config: DataViewQueryConfig<F>): DataViewWindowState[] {
  const keys = dataViewUrlKeys(config.paramPrefix)
  const current = deriveDataViewWindow(urlState, config)
  switch (current.kind) {
    case 'page':
      return stepsWithin(ADJACENT_WINDOW_RADIUS.page)
        .map(step => current.page + step)
        .filter(page => page >= 1 && page <= MAX_PAGE)
        .map(page => deriveDataViewWindow({ ...urlState, [keys.pageKey]: page }, config))
    case 'date':
      return stepsWithin(ADJACENT_WINDOW_RADIUS.date).map(step =>
        deriveDataViewWindow({ ...urlState, [keys.anchorKey]: stepAnchor(current.anchor, current.view, step) }, config),
      )
    case 'whole-list':
      return []
  }
}
