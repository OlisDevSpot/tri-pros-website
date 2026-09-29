import type { CalendarViewType } from '@/shared/constants/enums'
import type { DataViewQueryConfig, DataViewWindowState } from '@/shared/dal/lib/query/data-view-query-config'
import type { FieldList } from '@/shared/dal/lib/query/field-list'

import { MAX_PAGE } from '@/shared/dal/lib/query/constants'
import { dataViewUrlKeys, deriveDataViewWindow } from '@/shared/dal/lib/query/derive-data-view-input'
import { addCalendarDays } from '@/shared/lib/business-time'

function stepAnchor(anchor: string, view: CalendarViewType, step: -1 | 1): string {
  switch (view) {
    case 'today':
      return addCalendarDays(anchor, step)
    case 'week':
      return addCalendarDays(anchor, 7 * step)
    case 'month': {
      // Any day of the neighbouring month derives the same month grid; the 1st plus 31 days is always next month.
      const firstOfMonth = `${anchor.slice(0, 7)}-01`
      return addCalendarDays(firstOfMonth, step === 1 ? 31 : -1)
    }
  }
}

/**
 * The windows either side of the current one: the previous and next page, or the previous and next day, week or
 * month. Each is derived from URL state the way navigating there would write it, so a prefetched window's read
 * input is the one the view asks for on arrival. A whole-list view has none.
 */
export function adjacentDataViewWindows<F extends FieldList>(urlState: Record<string, unknown>, config: DataViewQueryConfig<F>): DataViewWindowState[] {
  const keys = dataViewUrlKeys(config.paramPrefix)
  const current = deriveDataViewWindow(urlState, config)
  switch (current.kind) {
    case 'page':
      return [current.page - 1, current.page + 1]
        .filter(page => page >= 1 && page <= MAX_PAGE)
        .map(page => deriveDataViewWindow({ ...urlState, [keys.pageKey]: page }, config))
    case 'date':
      return ([-1, 1] as const).map(step =>
        deriveDataViewWindow({ ...urlState, [keys.anchorKey]: stepAnchor(current.anchor, current.view, step) }, config),
      )
    case 'whole-list':
      return []
  }
}
