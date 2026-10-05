'use client'

import type { CustomerWithProfile } from '@/shared/entities/customers/dal/server/queries'
import { ArrowLeftIcon, MenuIcon, XIcon } from 'lucide-react'
import Link from 'next/link'
import { PANEL_ID } from '@/features/meeting-flow/constants/shell'
import { SHELL_COPY } from '@/features/meeting-flow/constants/shell-copy'
import { CustomerChip } from '@/features/meeting-flow/ui/components/shell/customer-chip'
import { StepTabs } from '@/features/meeting-flow/ui/components/shell/step-tabs'
import { SyncStatusIndicator } from '@/features/meeting-flow/ui/components/sync-status-indicator'
import { Logo } from '@/shared/components/logo'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'

interface TopBarProps {
  customer: Pick<CustomerWithProfile, 'id' | 'name' | 'address' | 'city' | 'state' | 'zip'> | null
  meetingId: string
  currentStep: number
  onStepClick: (step: number) => void
  syncStatus: string
  panelOpen: boolean
  onTogglePanel: () => void
}

/**
 * Three-column top bar: back link + customer | step tabs | sync + logo + hamburger.
 * The outer columns are `min-w-0 overflow-hidden`, so nothing collides at 1024px;
 * the centre column takes its natural width. Visibility follows the bar's own width
 * (`@container/topbar`), not the viewport, because the sidebar takes 256px of it:
 * the back label and the logo need a bar of at least 56rem, the tabs 42rem, the
 * tab labels 81.25rem. Below those they are hidden rather than clipped mid-word.
 * The right column is pinned to track 3 because a hidden tab strip is not a grid item.
 * At lg+ the bar has no right padding and the hamburger sits in a rail-wide slot, so it
 * shares the inspector rail's centre line; the sync dot moves down into the rail there.
 */
export function TopBar({ customer, meetingId, currentStep, onStepClick, syncStatus, panelOpen, onTogglePanel }: TopBarProps) {
  const panelLabel = panelOpen ? SHELL_COPY.closePanel : SHELL_COPY.openPanel

  return (
    <header className="@container/topbar grid h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-border/40 px-3 md:px-4 lg:pr-0">
      <div className="flex min-w-0 items-center gap-1 overflow-hidden">
        <Button
          asChild
          className="size-11 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground @4xl/topbar:w-auto @4xl/topbar:px-3"
          size="icon"
          variant="ghost"
        >
          <Link href={ROOTS.dashboard.meetings.root()} title={SHELL_COPY.backToMeetings}>
            <ArrowLeftIcon className="size-5" />
            <span className="hidden @4xl/topbar:inline">{SHELL_COPY.backToMeetings}</span>
          </Link>
        </Button>
        <CustomerChip customer={customer} meetingId={meetingId} />
      </div>

      <StepTabs currentStep={currentStep} onStepClick={onStepClick} />

      <div className="col-start-3 flex min-w-0 items-center justify-end gap-2 overflow-hidden">
        <SyncStatusIndicator className="lg:hidden" side="bottom" status={syncStatus} />
        <div className="hidden h-8 w-28 shrink-0 @4xl/topbar:block">
          <Logo variant="right" />
        </div>
        <div className="flex shrink-0 justify-center lg:w-12">
          <Button
            aria-controls={PANEL_ID}
            aria-expanded={panelOpen}
            className="size-11 shrink-0"
            size="icon"
            title={panelLabel}
            variant="ghost"
            onClick={onTogglePanel}
          >
            {panelOpen ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
            <span className="sr-only">{panelLabel}</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
