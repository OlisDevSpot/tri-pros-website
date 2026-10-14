const ROOT = '[cmdk-root]'
const CONTACT_GROUP = '[data-contact-actions]'
// An open contact menu is portaled out of its capsule but is still part of the contact flow.
const CONTACT_FLOW = `${CONTACT_GROUP}, [data-radix-menu-content]`

export function isInContactGroup(element: Element | null): boolean {
  return !!element?.closest(CONTACT_FLOW)
}

/** Hands focus back to the palette's input from anywhere inside the palette. */
export function focusOmniInput(from: Element | null): void {
  from?.closest(ROOT)?.querySelector<HTMLInputElement>('[cmdk-input]')?.focus()
}

/** → with the caret at the end of the input: focus the highlighted customer's capsule at its roving stop. */
export function focusHighlightedContact(input: HTMLInputElement): boolean {
  const caretAtEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length
  // A disabled row is a stale answer about to unmount; focus inside it would drop to the dialog container.
  const row = caretAtEnd ? input.closest(ROOT)?.querySelector('[cmdk-item][data-selected="true"]:not([data-disabled="true"])') : null
  const button = row?.closest('[data-omni-contact-row]')?.querySelector<HTMLButtonElement>(`${CONTACT_GROUP} button[data-roving-stop]`)
  button?.focus()
  return !!button
}
