import type { ReactNode } from 'react'

// Isolated design-system proof surface. `.theme-marketing` scopes the warm
// showcase tokens; `text-foreground` re-asserts color under the app-wide
// `<html class="dark">` (same reason as the funnel layout).
export default function TestLayout({ children }: { children: ReactNode }) {
  return <div className="theme-marketing bg-background text-foreground min-h-dvh">{children}</div>
}
