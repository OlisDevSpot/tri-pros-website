'use client'

import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/utils'

interface RecordsPageShellProps {
  /** Records-page header bar (typically `<RecordsPageHeader />`). */
  header: ReactNode
  /** Toolbar (typically `<QueryToolbar>` with its slot composition). */
  toolbar: ReactNode
  /** Data view (typically `<DataTable />`). The shell wraps it in a
   *  `flex-1 min-h-0` cell so it fills the remaining vertical space and
   *  scrolls correctly inside the parent's flex column. */
  table: ReactNode
  className?: string
}

/**
 * Canonical records-page layout. Three slots, one shape — every records
 * page (Proposals, Meetings, Activities, …) composes the same Header +
 * Toolbar + Table trio so consumer files read identically across entities.
 *
 * The shell owns:
 *   - The outer flex column with `h-full min-h-0` so the table area can
 *     scroll inside a constrained-height parent
 *   - The vertical gap between header / toolbar / table
 *   - The `flex-1 min-h-0` wrapping on the table slot so it fills available
 *     vertical space and its inner scroll region works correctly
 *
 * Modals and dialogs are not part of the shell — render them as siblings
 * in a fragment alongside `<RecordsPageShell />`.
 */
export function RecordsPageShell({ header, toolbar, table, className }: RecordsPageShellProps) {
  return (
    <div className={cn('flex h-full min-h-0 flex-col gap-3', className)}>
      {header}
      {toolbar}
      <div className="min-h-0 flex-1">
        {table}
      </div>
    </div>
  )
}
