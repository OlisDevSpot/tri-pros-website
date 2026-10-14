/** Optional control over a contact action's menu. Left out, the menu opens and closes as Radix does by default. */
export interface ContactMenuControl {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Runs when the menu closes; `event.preventDefault()` keeps focus off the trigger. */
  onCloseAutoFocus?: (event: Event) => void
}
