import type { ReactNode } from 'react'

// Clips vertically only: the table's scroller reaches out into the page's side insets.
export function RecordsPageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col overflow-y-clip">
      {children}
    </div>
  )
}
