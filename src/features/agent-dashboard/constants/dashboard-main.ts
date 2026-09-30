/**
 * The dashboard template's `<main>` box; the layout's loading state uses the same box so its content lines up.
 * On phones the bottom padding clears the floating dock (56px tall on its safe-area baseline) plus 16px of air.
 */
export const DASHBOARD_MAIN_CLASS = 'relative min-h-0 min-w-0 flex-1 overflow-hidden px-4 pb-[calc(3.5rem+max(1rem,env(safe-area-inset-bottom))+1rem)] pt-4 md:px-6 md:py-6 md:pb-6 has-data-stage:p-0'
