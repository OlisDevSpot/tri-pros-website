'use client'

import type { AppRouterOutputs } from '@/trpc/routers/app'

import { ArchiveIcon, MoreHorizontalIcon, PauseIcon, SettingsIcon } from 'lucide-react'
import { motion } from 'motion/react'

import { useEntranceMotion } from '@/features/lead-sources-admin/lib/use-entrance-motion'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { cn } from '@/shared/lib/utils'

type LeadSourceRow = AppRouterOutputs['leadSourcesRouter']['getById']

interface LeadSourceDetailHeaderProps {
  source: LeadSourceRow
  onJumpToSettings: () => void
}

export function LeadSourceDetailHeader({ source, onJumpToSettings }: LeadSourceDetailHeaderProps) {
  const entrance = useEntranceMotion()

  return (
    <header className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <motion.p
          {...entrance(0, 6)}
          className="text-[11px] text-muted-foreground"
        >
          <span className="font-medium uppercase tracking-[0.18em]">Lead source</span>
          <span aria-hidden="true" className="mx-2 opacity-40">·</span>
          <span className="tabular-nums" translate="no">
            /
            {source.slug}
          </span>
        </motion.p>
        <motion.h2
          {...entrance(0.04, 6)}
          className="truncate text-3xl font-semibold tracking-tight text-foreground"
        >
          {source.name}
        </motion.h2>
      </div>
      <motion.div {...entrance(0.08, 6)} className="flex shrink-0 items-center gap-3">
        <ActiveIndicator isActive={source.isActive} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 sm:h-8 sm:w-8"
              aria-label="Lead source actions"
            >
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={onJumpToSettings}>
              <SettingsIcon className="size-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onJumpToSettings}>
              <PauseIcon className="size-4" />
              Pause intake
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onJumpToSettings}>
              <ArchiveIcon className="size-4" />
              Archive…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.div>
    </header>
  )
}

function ActiveIndicator({ isActive }: { isActive: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 rounded-full',
          isActive ? 'bg-emerald-500' : 'bg-muted-foreground/40',
        )}
      />
      <span className={cn('text-xs', isActive ? 'text-foreground' : 'text-muted-foreground')}>
        {isActive ? 'Active' : 'Inactive'}
      </span>
    </span>
  )
}
