/**
 * True when a DOM event target sits inside the Sonner toaster. Modal content uses it so a toast action
 * (for example Undo) can be tapped while a modal is open without dismissing the modal underneath.
 */
export function isToastTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-sonner-toaster]') !== null
}
