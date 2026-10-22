'use client'

import type { ProposalFormActions } from '@/features/proposal-flow/hooks/use-proposal-form-actions'
import { CalculatorIcon, ChevronDownIcon, EyeIcon, SaveIcon, SettingsIcon } from 'lucide-react'
import { useState } from 'react'
import { TOOLBAR_BUTTON_ACTIVE, TOOLBAR_BUTTON_BASE, TOOLBAR_BUTTON_INACTIVE } from '@/features/proposal-flow/constants/proposal-toolbar'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { cn } from '@/shared/lib/utils'
import { CompactSaveSplit } from './compact-save-split'
import { PricingModeSettings } from './pricing-mode-settings'

interface Props {
  isLoading: boolean
  viewHref: string
  actions: ProposalFormActions
}

export function ProposalToolbar({ isLoading, viewHref, actions }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [saveOpenMobile, setSaveOpenMobile] = useState(false)
  const [saveOpenDesktop, setSaveOpenDesktop] = useState(false)
  const saveOpen = saveOpenMobile || saveOpenDesktop

  function closeSavePopovers() {
    setSaveOpenMobile(false)
    setSaveOpenDesktop(false)
  }

  function handleSaveAndPreview() {
    closeSavePopovers()
    actions.saveAndPreview()
  }

  function handleSaveOnly() {
    closeSavePopovers()
    actions.saveOnly()
  }

  return (
    <div className="inline-flex h-9 items-center gap-0.5 rounded-lg border border-control-border bg-tab-track p-0.5">
      <button
        type="button"
        onClick={actions.openInternalFinancials}
        className={cn(TOOLBAR_BUTTON_BASE, 'aspect-square', TOOLBAR_BUTTON_INACTIVE)}
        aria-label="Internal financials"
      >
        <CalculatorIcon className="size-3.5" />
      </button>

      <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Proposal settings"
            className={cn(
              TOOLBAR_BUTTON_BASE,
              'aspect-square',
              settingsOpen ? TOOLBAR_BUTTON_ACTIVE : TOOLBAR_BUTTON_INACTIVE,
            )}
          >
            <SettingsIcon className="size-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="end">
          <PricingModeSettings />
        </PopoverContent>
      </Popover>

      {viewHref && (
        <a
          href={viewHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Preview"
          className={cn(TOOLBAR_BUTTON_BASE, 'aspect-square', TOOLBAR_BUTTON_INACTIVE)}
        >
          <EyeIcon className="size-3.5" />
        </a>
      )}

      <div
        className={cn(
          TOOLBAR_BUTTON_BASE,
          'gap-0 px-0',
          saveOpen ? TOOLBAR_BUTTON_ACTIVE : TOOLBAR_BUTTON_INACTIVE,
          isLoading && 'pointer-events-none opacity-50',
        )}
      >
        <button
          type="button"
          disabled={isLoading}
          className="hidden items-center gap-1.5 px-2 leading-none lg:inline-flex"
          onClick={handleSaveOnly}
        >
          <SaveIcon className="size-3.5 shrink-0" />
          <span className="text-sm font-medium">Save</span>
        </button>
        <Popover open={saveOpenDesktop} onOpenChange={setSaveOpenDesktop}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={isLoading}
              className="hidden items-center border-l border-control-border ml-1 px-1.5 rounded-r-md transition-colors hover:bg-hover pressed:bg-press lg:inline-flex"
            >
              <ChevronDownIcon className="size-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-1" align="end">
            <div className="flex flex-col">
              <Button type="button" variant="ghost" size="sm" className="justify-start" onClick={handleSaveOnly}>Save</Button>
              <Button type="button" variant="ghost" size="sm" className="justify-start" onClick={handleSaveAndPreview}>Save & Preview</Button>
            </div>
          </PopoverContent>
        </Popover>
        <CompactSaveSplit
          open={saveOpenMobile}
          onOpenChange={setSaveOpenMobile}
          isLoading={isLoading}
          onSave={handleSaveOnly}
          onSaveAndPreview={handleSaveAndPreview}
        />
      </div>
    </div>
  )
}
