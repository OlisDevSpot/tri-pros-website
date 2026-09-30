'use client'

import type { MobileDockTab as MobileDockTabConfig } from '@/features/agent-dashboard/lib/get-mobile-dock-tabs'

import Link from 'next/link'

import { cn } from '@/shared/lib/utils'

interface MobileDockTabProps {
  tab: MobileDockTabConfig
  href: string
  isActive: boolean
  onNavigate: () => void
}

export function MobileDockTab({ tab, href, isActive, onNavigate }: MobileDockTabProps) {
  const Icon = tab.item.icon
  return (
    <Link
      href={href}
      onNavigate={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[14px] outline-none [-webkit-tap-highlight-color:transparent]',
        'transition-[color,transform] duration-200 active:scale-[0.94] motion-reduce:transition-none motion-reduce:active:scale-100',
        'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
        isActive ? 'text-sidebar-accent-foreground' : 'text-sidebar-muted',
      )}
    >
      <Icon aria-hidden className={cn('size-5 transition-colors duration-200', isActive && 'text-sidebar-primary')} strokeWidth={isActive ? 2.25 : 2} />
      <span className="text-xs leading-none font-semibold tracking-tight max-[379px]:tracking-tighter">{tab.label}</span>
    </Link>
  )
}
