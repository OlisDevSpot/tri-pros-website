import { ROW_INTERACTIVE_SELECTOR } from '@/shared/components/data-table/constants/row-interactive-selector'

interface RowClickEventLike {
  currentTarget: { contains: (other: Node | null) => boolean }
  target: EventTarget | null
}

/** Whether a click on a row is meant for the row, rather than for a control inside it or a text selection. */
export function isRowClick(event: RowClickEventLike, selectedText: string): boolean {
  const target = event.target as Element | null
  // Portaled popover, menu and dialog content bubbles to the row through React's tree but lives outside it in the DOM.
  if (!target || !event.currentTarget.contains(target)) {
    return false
  }
  const interactive = target.closest(ROW_INTERACTIVE_SELECTOR)
  if (interactive && event.currentTarget.contains(interactive)) {
    return false
  }
  // Selecting text by dragging ends in a click; the user is reading, not toggling.
  return selectedText.length === 0
}
