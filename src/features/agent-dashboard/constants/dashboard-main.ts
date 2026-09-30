/**
 * The dashboard template's `<main>` box; the layout's loading state uses the same box so its content lines up.
 * On phones the bottom padding clears the floating dock (56px tall on its safe-area baseline) plus 16px of air.
 * From md up the rail's own right inset is the left gutter, so the page margin matches the rail's gap on every side.
 */
export const DASHBOARD_MAIN_CLASS = 'relative min-h-0 min-w-0 flex-1 overflow-hidden px-4 pb-[calc(3.5rem+max(1rem,env(safe-area-inset-bottom))+1rem)] pt-4 md:pt-(--gutter) md:pr-(--gutter) md:pb-(--gutter) md:pl-0 has-data-stage:p-0'
