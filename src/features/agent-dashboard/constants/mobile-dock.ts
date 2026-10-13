// Same baseline as the meeting flow's step capsule: clear of the home indicator in a standalone
// PWA, 16px off the edge everywhere else.
export const MOBILE_DOCK_BOTTOM_CLASS = 'bottom-(--dock-baseline)'

export const MOBILE_DOCK_SURFACE_CLASS = 'border border-sidebar-border bg-sidebar bg-(image:--sidebar-sheen) shadow-lg'

// The menu sheet lands 8px above the dock (baseline + 56px dock), so the button that opened it
// stays where the thumb is and closes it; its cap leaves backdrop to tap and keeps the top clear
// of the status bar. Its travel adds that lift, so it rises from below the screen, behind the dock.
export const MOBILE_DOCK_SHEET_CLASS = [
  'inset-x-3 bottom-[calc(var(--dock-baseline)+var(--dock-h)+0.5rem)]',
  'max-h-[min(78dvh,calc(100dvh-env(safe-area-inset-top)-var(--dock-baseline)-var(--dock-h)-1.5rem))]',
  '[--sheet-travel:calc(100%+var(--dock-baseline)+var(--dock-h)+1.5rem)]',
].join(' ')
