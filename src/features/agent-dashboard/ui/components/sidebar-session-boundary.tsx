'use client'

import { Suspense } from 'react'

import { useSidebar } from '@/shared/components/ui/sidebar'

// Subscribing to the sidebar context is the point: when the provider flips `isMobile`
// after the shell hydrates, this Suspense gets new props, so React hydrates the
// still-dehydrated sidebar against the context it was server-rendered with before
// applying the flip. Without it the boundary bails out, hydrates later against the
// flipped value, and mismatches on every phone load.
export function SidebarSessionBoundary({ fallback, children }: { fallback: React.ReactNode, children: React.ReactNode }) {
  useSidebar()
  return <Suspense fallback={fallback}>{children}</Suspense>
}
