// Inserts text at a textarea's selection, returning the new value + caret
// position so the caller can setState then restore the caret. Pure given the
// element's current selection.

export function insertAtCursor(
  el: HTMLTextAreaElement,
  text: string,
): { value: string, caret: number } {
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? el.value.length
  const value = el.value.slice(0, start) + text + el.value.slice(end)
  return { value, caret: start + text.length }
}
