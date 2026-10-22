'use client'

import type { ProposalFormActions } from '@/features/proposal-flow/hooks/use-proposal-form-actions'
import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { CalculatorIcon, ChevronDownIcon, EyeIcon, SaveIcon, SettingsIcon } from 'lucide-react'
import { useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { TOOLBAR_BUTTON_ACTIVE, TOOLBAR_BUTTON_BASE, TOOLBAR_BUTTON_INACTIVE } from '@/features/proposal-flow/constants/proposal-toolbar'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Switch } from '@/shared/components/ui/switch'
import { cn } from '@/shared/lib/utils'

interface Props {
  isLoading: boolean
  viewHref: string
  actions: ProposalFormActions
}

export function ProposalToolbar({ isLoading, viewHref, actions }: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [saveOpenMobile, setSaveOpenMobile] = useState(false)
  const [saveOpenDesktop, setSaveOpenDesktop] = useState(false)
  const saveOpen = saveOpenMobile || saveOpenDesktop
  const pricingMode = useWatch({ control: form.control, name: 'priceDisplayMode' })

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
      {/* Internal financials */}
      <button
        type="button"
        onClick={actions.openInternalFinancials}
        className={cn(TOOLBAR_BUTTON_BASE, 'aspect-square', TOOLBAR_BUTTON_INACTIVE)}
        aria-label="Internal financials"
      >
        <CalculatorIcon className="size-3.5" />
      </button>

      {/* Settings */}
      <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
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
          <div className="space-y-4">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">General</p>
              <div className="flex items-center justify-between">
                <Label htmlFor="pricing-mode" className="text-sm font-normal">
                  Breakdown Pricing
                </Label>
                <Switch
                  id="pricing-mode"
                  checked={pricingMode === 'breakdown'}
                  onCheckedChange={checked =>
                    form.setValue('priceDisplayMode', checked ? 'breakdown' : 'total')}
                />
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* View */}
      {viewHref && (
        <a
          href={viewHref}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(TOOLBAR_BUTTON_BASE, 'aspect-square', TOOLBAR_BUTTON_INACTIVE)}
        >
          <EyeIcon className="size-3.5" />
        </a>
      )}

      {/* Save — split button */}
      <div
        className={cn(
          TOOLBAR_BUTTON_BASE,
          'gap-0 px-0',
          saveOpen ? TOOLBAR_BUTTON_ACTIVE : TOOLBAR_BUTTON_INACTIVE,
          isLoading && 'pointer-events-none opacity-50',
        )}
      >
        {/* Desktop: label triggers save, chevron opens popover */}
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
        {/* Mobile: entire button opens popover */}
        <Popover open={saveOpenMobile} onOpenChange={setSaveOpenMobile}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={isLoading}
              className="inline-flex items-center gap-0.5 px-1.5 lg:hidden"
            >
              <SaveIcon className="size-3.5" />
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
      </div>
    </div>
  )
}
