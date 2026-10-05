import type { SearchParams } from 'nuqs/server'

import type { DataViewInput, DataViewQueryConfig } from '@/shared/dal/lib/query/data-view-query-config'
import type { FieldList } from '@/shared/dal/lib/query/field-list'

import { createLoader } from 'nuqs/server'

import { deriveDataViewInput, makeDataViewParsers } from '@/shared/dal/lib/query/derive-data-view-input'
import 'server-only'

/**
 * The server half of `useDataViewQuery`'s first render: same parsers, same derivation, same config
 * object. `extra` must equal the hook's `extra`, or the prefetch is wasted.
 */
export async function loadDataViewQueryInput<F extends FieldList, TExtra extends object = Record<string, never>>(
  searchParams: Promise<SearchParams> | SearchParams,
  config: DataViewQueryConfig<F>,
  extra?: TExtra,
): Promise<DataViewInput<F> & TExtra> {
  // The parser map is built at runtime, which createLoader's generic can't express.
  const load = createLoader(makeDataViewParsers(config) as never)
  const urlState = await load(Promise.resolve(searchParams))
  return { ...deriveDataViewInput(urlState as Record<string, unknown>, config), ...extra } as DataViewInput<F> & TExtra
}
