// The header pickers have no message of their own; the open body shows it, and the picker points to it by this id.
export function sowPickerMessageId(baseId: string, index: number, picker: 'trade' | 'scopes'): string {
  return `${baseId}-sow-${index}-${picker}-message`
}
