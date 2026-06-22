'use client'

import type { AppRouterOutputs } from '@/trpc/routers/app'

import { ArchiveIcon, MoreHorizontalIcon, PauseIcon, PlayIcon, PlusIcon, SettingsIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useRouter } from 'next/navigation'

import { useEntranceMotion } from '@/features/lead-sources-admin/lib/use-entrance-motion'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { ROOTS } from '@/shared/config/roots'
import { useLeadSourceActions } from '@/shared/entities/lead-sources/hooks/use-lead-source-actions'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { cn } from '@/shared/lib/utils'

type LeadSourceRow = AppRouterOutputs['leadSourcesRouter']['getById']

interface LeadSourceDetailHeaderProps {
  source: LeadSourceRow
  onJumpToSettings: () => void
  onAddCustomer: () => void
}

export function LeadSourceDetailHeader({ source, onJumpToSettings, onAddCustomer }: LeadSourceDetailHeaderProps) {
  const entrance = useEntranceMotion()
  const router = useRouter()
  const { toggleActive, archiveLeadSource } = useLeadSourceActions()
  const [ArchiveConfirmDialog, confirmArchive] = useConfirm({
    title: 'Archive this lead source?',
    message: 'It will be hidden from the lead-source list. Existing customers stay attached.',
  })

  const onTogglePause = () => {
    toggleActive.mutate({ id: source.id, isActive: !source.isActive })
  }

  const onArchive = async () => {
    const ok = await confirmArchive()
    if (!ok) {
      return
    }
    archiveLeadSource.mutate({ id: source.id }, {
      onSuccess: () => router.push(ROOTS.dashboard.leadSources()),
    })
  }

  return (
    <header className="flex items-start justify-between gap-3">
      <ArchiveConfirmDialog />
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
      <motion.div {...entrance(0.08, 6)} className="flex shrink-0 items-center gap-2 sm:gap-3">
        <ActiveIndicator isActive={source.isActive} />
        <Button
          size="sm"
          onClick={onAddCustomer}
          className="size-11 px-0 sm:h-9 sm:w-auto sm:gap-1.5 sm:px-4"
          aria-label="Add customer"
        >
          <PlusIcon className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Add customer</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 sm:size-9"
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
            <DropdownMenuItem onSelect={onTogglePause} disabled={toggleActive.isPending}>
              {source.isActive ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
              {source.isActive ? 'Pause intake' : 'Resume intake'}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onArchive} disabled={archiveLeadSource.isPending}>
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
      <span className={cn('hidden text-xs sm:inline', isActive ? 'text-foreground' : 'text-muted-foreground')}>
        {isActive ? 'Active' : 'Inactive'}
      </span>
    </span>
  )
}
