import type { ReactNode } from 'react'

// No entrance fade of its own: the dashboard template already fades every soft navigation, and a
// second fade stacked on it adds a second end-of-fade flash.
export function RecordsPageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {children}
    </div>
  )
}
