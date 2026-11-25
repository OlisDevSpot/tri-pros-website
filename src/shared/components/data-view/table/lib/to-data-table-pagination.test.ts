import type { DataViewQueryResult } from '@/shared/dal/client/lib/types'
import type { FieldList } from '@/shared/dal/lib/query/field-list'
import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { toDataTablePagination } from './to-data-table-pagination'

type PageQuery = DataViewQueryResult<unknown, FieldList, string, 'page'>

function pageQuery(state: Pick<PageQuery, 'isPending' | 'isStale' | 'isFetching'>): PageQuery {
  return {
    rows: [],
    total: 0,
    ...state,
    refresh: async () => {},
    filterSort: {} as PageQuery['filterSort'],
    window: { kind: 'page', page: 1, pageSize: 25, pageSizeOptions: [25], pageCount: 0, setPage: () => {}, setPageSize: () => {} },
  }
}

describe('toDataTablePagination footer state', () => {
  it('a row-less view (first load or error fallback) is pending, not updating', () => {
    const pagination = toDataTablePagination(pageQuery({ isPending: true, isStale: false, isFetching: false }))
    assert.equal(pagination.isPending, true)
    assert.equal(pagination.isFetching, false)
  })

  it('a refresh of rows already on screen is updating', () => {
    const pagination = toDataTablePagination(pageQuery({ isPending: false, isStale: false, isFetching: true }))
    assert.equal(pagination.isPending, false)
    assert.equal(pagination.isFetching, true)
  })

  it('settled rows are neither', () => {
    const pagination = toDataTablePagination(pageQuery({ isPending: false, isStale: false, isFetching: false }))
    assert.equal(pagination.isPending, false)
    assert.equal(pagination.isFetching, false)
  })
})
