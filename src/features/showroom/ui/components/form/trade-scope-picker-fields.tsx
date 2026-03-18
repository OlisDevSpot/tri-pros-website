'use client'

import type { TradeRow } from '@/features/showroom/lib/group-scopes-by-trade'
import type { ProjectFormData } from '@/shared/entities/projects/schemas'
import { useQuery } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { groupScopesByTrade } from '@/features/showroom/lib/group-scopes-by-trade'
import { Button } from '@/shared/components/ui/button'
import { useTRPC } from '@/trpc/helpers'
import { TradeScopeRow } from './trade-scope-row'

type RowsAction
  = | { type: 'init', rows: TradeRow[] }
    | { type: 'set_trade', index: number, tradeId: string }
    | { type: 'set_scopes', index: number, scopeIds: string[] }
    | { type: 'delete', index: number }
    | { type: 'add' }

function rowsReducer(state: TradeRow[], action: RowsAction): TradeRow[] {
  switch (action.type) {
    case 'init':
      return action.rows
    case 'set_trade':
      return state.map((r, i) => i === action.index ? { tradeId: action.tradeId, scopeIds: [] } : r)
    case 'set_scopes':
      return state.map((r, i) => i === action.index ? { ...r, scopeIds: action.scopeIds } : r)
    case 'delete':
      return state.filter((_, i) => i !== action.index)
    case 'add':
      return [...state, { tradeId: '', scopeIds: [] }]
  }
}

export function TradeScopePickerFields() {
  const form = useFormContext<ProjectFormData>()
  const trpc = useTRPC()
  const initializedRef = useRef(false)

  const { data: trades = [] } = useQuery(trpc.notionRouter.trades.getAll.queryOptions())
  const { data: allScopes = [] } = useQuery(trpc.notionRouter.scopes.getAll.queryOptions())

  const [rows, dispatch] = useReducer(rowsReducer, [])

  // Watch scopeIds reactively so we catch the form.reset() from initialValues
  const watchedScopeIds = useWatch({ control: form.control, name: 'scopeIds' })

  // Initialize rows when both allScopes and form scopeIds become available
  useEffect(() => {
    if (allScopes.length === 0 || initializedRef.current) {
      return
    }
    if (watchedScopeIds.length > 0) {
      initializedRef.current = true
      const grouped = groupScopesByTrade(watchedScopeIds, allScopes)
      if (grouped.length > 0) {
        dispatch({ type: 'init', rows: grouped })
      }
    }
  }, [watchedScopeIds, allScopes])

  const syncToForm = useCallback((updatedRows: TradeRow[]) => {
    const flat = updatedRows.flatMap(r => r.scopeIds)
    form.setValue('scopeIds', flat, { shouldDirty: true })
  }, [form])

  const dispatchAndSync = useCallback((action: RowsAction) => {
    dispatch(action)
    const nextRows = rowsReducer(rows, action)
    syncToForm(nextRows)
  }, [rows, syncToForm])

  const handleTradeChange = useCallback((index: number, tradeId: string) => {
    dispatchAndSync({ type: 'set_trade', index, tradeId })
  }, [dispatchAndSync])

  const handleScopesChange = useCallback((index: number, scopeIds: string[]) => {
    dispatchAndSync({ type: 'set_scopes', index, scopeIds })
  }, [dispatchAndSync])

  const handleDelete = useCallback((index: number) => {
    dispatchAndSync({ type: 'delete', index })
  }, [dispatchAndSync])

  const handleAdd = useCallback(() => {
    dispatch({ type: 'add' })
  }, [])

  const usedTradeIds = new Set(rows.map(r => r.tradeId).filter(Boolean))

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <TradeScopeRow
          key={row.tradeId || `empty-${index}`}
          tradeId={row.tradeId}
          selectedScopeIds={row.scopeIds}
          allTrades={trades}
          usedTradeIds={usedTradeIds}
          onTradeChange={tradeId => handleTradeChange(index, tradeId)}
          onScopesChange={scopeIds => handleScopesChange(index, scopeIds)}
          onDelete={() => handleDelete(index)}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAdd}
        disabled={usedTradeIds.size >= trades.length}
      >
        <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
        Add Trade
      </Button>
    </div>
  )
}
