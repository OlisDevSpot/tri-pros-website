/**
 * Per-column width pattern for skeleton placeholder rows. Real table rows
 * have content of varying widths (short ids, long names, status pills,
 * date strings) — uniform skeleton bars look fake. Cycling through these
 * widths by column index makes the loading state read as a real table.
 *
 * Same column always gets the same width across all skeleton rows so the
 * table reads as "columns with content," not random bars.
 */
export const SKELETON_CELL_WIDTHS = [
  'w-1/2',
  'w-3/4',
  'w-1/3',
  'w-2/3',
  'w-3/5',
  'w-2/5',
] as const

/**
 * A skeleton row's height: the rendered height of a two-line row (the customers tables). Tables whose rows
 * render at another height pass their own through `DataTable`'s `skeletonRowClassName`, so the swap to rows
 * moves nothing.
 */
export const SKELETON_ROW_HEIGHT_CLASS = 'h-[61px]'
