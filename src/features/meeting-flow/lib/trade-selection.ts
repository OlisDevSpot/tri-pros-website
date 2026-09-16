import type { SelectionItem, TradeScopeGroup } from '@/features/meeting-flow/types'
import type { TradeSelection } from '@/shared/entities/meetings/schemas'

interface TradeRef {
  id: string
  name: string
}

export function findTradeSelection(selections: TradeSelection[], tradeId: string): TradeSelection | undefined {
  return selections.find(s => s.tradeId === tradeId)
}

export function itemCount(selection: TradeSelection | undefined): number {
  return selection?.selectedScopes.length ?? 0
}

/** Selected means one or more scopes or add-ons chosen. Reasons and notes alone do not count. */
export function isTradeSelected(selections: TradeSelection[], tradeId: string): boolean {
  return itemCount(findTradeSelection(selections, tradeId)) > 0
}

export function selectedItemIds(items: SelectionItem[] | undefined): string[] {
  return items?.map(item => item.id) ?? []
}

export function selectedTradeSelections(selections: TradeSelection[]): TradeSelection[] {
  return selections.filter(s => itemCount(s) > 0)
}

function hasContent(selection: TradeSelection): boolean {
  return itemCount(selection) > 0 || selection.painPoints.length > 0 || (selection.notes ?? '').trim().length > 0
}

/**
 * The shape written to `flowStateJSON`. An entry is kept when it has one or more items,
 * one or more reasons, or a note with non-whitespace text, or when `server` already
 * holds an entry for the same trade (meeting creation and the old step saved zero-item
 * trades; an edit elsewhere must not delete them). Only an entry that is completely
 * empty and absent from `server` is dropped. Removing a trade takes the entry out of
 * the model (`withoutTrade`), so the next write deletes it.
 */
export function normalizeForWrite(selections: TradeSelection[], server: TradeSelection[]): TradeSelection[] {
  const onServer = new Set(server.map(s => s.tradeId))
  return selections.filter(s => hasContent(s) || onServer.has(s.tradeId))
}

/**
 * Fixed key order and a normalized `notes`, so two equal models serialize the same.
 * Postgres jsonb reorders object keys, so raw `JSON.stringify` cannot compare a write with its echo.
 */
export function canonicalSelectionsJson(selections: TradeSelection[]): string {
  return JSON.stringify(selections.map(s => ({
    tradeId: s.tradeId,
    tradeName: s.tradeName,
    selectedScopes: s.selectedScopes.map(item => ({ id: item.id, label: item.label })),
    painPoints: [...s.painPoints],
    notes: s.notes ?? '',
  })))
}

function upsert(
  selections: TradeSelection[],
  trade: TradeRef,
  update: (current: TradeSelection) => TradeSelection,
): TradeSelection[] {
  const existing = findTradeSelection(selections, trade.id)
  if (!existing) {
    const created: TradeSelection = { tradeId: trade.id, tradeName: trade.name, selectedScopes: [], painPoints: [] }
    return [...selections, update(created)]
  }
  return selections.map(s => (s.tradeId === trade.id ? update(s) : s))
}

export function withItemToggled(selections: TradeSelection[], trade: TradeRef, item: SelectionItem): TradeSelection[] {
  return upsert(selections, trade, current => ({
    ...current,
    selectedScopes: current.selectedScopes.some(i => i.id === item.id)
      ? current.selectedScopes.filter(i => i.id !== item.id)
      : [...current.selectedScopes, { id: item.id, label: item.label }],
  }))
}

export function withReasonToggled(selections: TradeSelection[], trade: TradeRef, reason: string): TradeSelection[] {
  return upsert(selections, trade, current => ({
    ...current,
    painPoints: current.painPoints.includes(reason)
      ? current.painPoints.filter(r => r !== reason)
      : [...current.painPoints, reason],
  }))
}

export function withNote(selections: TradeSelection[], trade: TradeRef, note: string): TradeSelection[] {
  return upsert(selections, trade, current => ({ ...current, notes: note }))
}

export function withoutTrade(selections: TradeSelection[], tradeId: string): TradeSelection[] {
  return selections.filter(s => s.tradeId !== tradeId)
}

/** What changed between two ToggleGroup value arrays. */
export function diffIds(previous: readonly string[], next: readonly string[]): { added: string[], removed: string[] } {
  const before = new Set(previous)
  const after = new Set(next)
  return {
    added: next.filter(id => !before.has(id)),
    removed: previous.filter(id => !after.has(id)),
  }
}

/** Stored items that the current catalog does not list for this trade. Shown, never dropped silently. */
export function orphanItems(selection: TradeSelection | undefined, group: TradeScopeGroup | undefined): SelectionItem[] {
  if (!selection) {
    return []
  }
  const known = new Set([...(group?.scopes ?? []), ...(group?.addons ?? [])].map(entry => entry.id))
  return selection.selectedScopes.filter(item => !known.has(item.id))
}

/** Puts an entry back (Undo), replacing any entry for the same trade, at the end of the list. */
export function withTradeRestored(selections: TradeSelection[], entry: TradeSelection): TradeSelection[] {
  return [...withoutTrade(selections, entry.tradeId), entry]
}

/** True when `itemId` is the entry's only item, so removing it empties the trade (spec §4.2.3). */
export function isOnlyItem(entry: TradeSelection | undefined, itemId: string): boolean {
  return entry?.selectedScopes.length === 1 && entry.selectedScopes[0]?.id === itemId
}
