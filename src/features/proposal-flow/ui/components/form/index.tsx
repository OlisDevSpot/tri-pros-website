'use client'

import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { OverrideProposalValues } from '@/features/proposal-flow/types'
import { CalculatorIcon, ChevronDownIcon, EyeIcon, SaveIcon, SettingsIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { useEffect, useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { formValuesToProposal } from '@/features/proposal-flow/lib/converters'
import { baseDefaultValues } from '@/features/proposal-flow/schemas/form-schema'
import { InternalFinancialsModal } from '@/features/proposal-flow/ui/components/internal-financials-modal'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { Label } from '@/shared/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Switch } from '@/shared/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { cn } from '@/shared/lib/utils'
import { FundingFields } from './funding-fields'
import { GeneralFields } from './general-fields'
import { ProjectFields } from './project-fields'
import { ProposalMediaManager } from './proposal-media-manager'

const FORM_TABS = ['general', 'sow', 'funding', 'files'] as const
type FormTab = (typeof FORM_TABS)[number]

const TAB_LABELS: Record<FormTab, string> = {
  files: 'Files',
  funding: 'Funding',
  general: 'General',
  sow: 'Scope of Work',
}

const TOOLBAR_BUTTON_BASE = 'inline-flex size-[calc(100%-1px)] items-center justify-center rounded-md border border-transparent transition-[color,box-shadow]'
const TOOLBAR_BUTTON_INACTIVE = 'text-muted-foreground hover:text-foreground'
const TOOLBAR_BUTTON_ACTIVE = 'bg-background shadow-sm dark:border-input dark:bg-input/30'

interface Props {
  onSubmit: (data: ProposalFormSchema) => void
  onSave?: (data: ProposalFormSchema) => void
  isLoading: boolean
  initialValues?: OverrideProposalValues
  viewHref?: string
  proposalId?: string
}

function deepMergeDefaults(base: ProposalFormSchema, override: Props['initialValues'] = {}): ProposalFormSchema {
  if (Object.keys(override).length === 0) {
    return base
  }

  return {
    ...base,
    meta: { ...base.meta, ...(override.meta ?? {}) },
    project: { ...base.project, ...(override.project ?? {}) },
    funding: { ...base.funding, ...(override.funding ?? {}) },
  }
}

export function ProposalForm({ isLoading, onSubmit, onSave, initialValues, viewHref, proposalId }: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const [nuqsTab, setNuqsTab] = useQueryState(
    'formTab',
    parseAsStringLiteral(FORM_TABS).withDefault('general'),
  )
  const [activeTab, setActiveTab] = useState<FormTab>(nuqsTab)
  const isEditMode = !!onSave
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [saveOpenMobile, setSaveOpenMobile] = useState(false)
  const [saveOpenDesktop, setSaveOpenDesktop] = useState(false)
  const saveOpen = saveOpenMobile || saveOpenDesktop
  const pricingMode = useWatch({ control: form.control, name: 'meta.pricingMode' })
  const { open: openModal, setModal } = useModalStore()

  function handleInternalFinancials() {
    setModal({
      accessor: 'InternalFinancials',
      Component: InternalFinancialsModal,
      props: { proposalData: formValuesToProposal(form.getValues()) },
    })
    openModal()
  }

  useEffect(() => {
    setActiveTab(nuqsTab)
  }, [nuqsTab])

  function handleTabChange(val: string) {
    const tab = val as FormTab
    setActiveTab(tab)
    setNuqsTab(tab)
  }

  useEffect(() => {
    if (initialValues) {
      form.reset(deepMergeDefaults(baseDefaultValues, initialValues))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues])

  const onInvalid = (errors: any) => {
    // eslint-disable-next-line no-console
    console.log(form.getValues())
    // eslint-disable-next-line no-console
    console.log('INVALID SUBMIT', errors)
    toast.error('Form is invalid (check console)')
  }

  function closeSavePopovers() {
    setSaveOpenMobile(false)
    setSaveOpenDesktop(false)
  }

  function handleSaveAndPreview() {
    closeSavePopovers()
    form.handleSubmit(onSubmit, onInvalid)()
  }

  function handleSaveOnly() {
    closeSavePopovers()
    if (onSave) {
      form.handleSubmit(onSave, onInvalid)()
    }
    else {
      form.handleSubmit(onSubmit, onInvalid)()
    }
  }

  return (
    <form
      id="proposal-form"
      onSubmit={form.handleSubmit(onSubmit, onInvalid)}
      className="flex h-full w-full flex-col gap-3"
    >
      <div className="flex shrink-0 items-center justify-between gap-2">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
        >
          <TabsList>
            {FORM_TABS.map(tab => (
              <TabsTrigger key={tab} value={tab}>
                {TAB_LABELS[tab]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {isEditMode
          ? (
              <div className="inline-flex h-9 items-center gap-0.5 rounded-lg bg-muted p-0.75">
                {/* Internal financials */}
                <button
                  type="button"
                  onClick={handleInternalFinancials}
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
                              form.setValue('meta.pricingMode', checked ? 'breakdown' : 'total')}
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
                        className="hidden items-center border-l border-current/10 ml-1 px-1.5 rounded-r-md transition-colors hover:bg-foreground/5 lg:inline-flex"
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
          : (
              <Button
                type="button"
                size="sm"
                disabled={isLoading}
                onClick={handleSaveAndPreview}
              >
                <SaveIcon className="size-3.5" />
                Save & Preview
              </Button>
            )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Card className="w-full p-3 lg:p-5">
          {FORM_TABS.map((tab) => {
            const isActive = activeTab === tab
            return (
              <motion.div
                key={tab}
                animate={{ opacity: isActive ? 1 : 0 }}
                transition={{ duration: 0.15 }}
                className={isActive ? '' : 'hidden'}
              >
                {tab === 'general' && <GeneralFields />}
                {tab === 'sow' && <ProjectFields pricingMode={pricingMode} />}
                {tab === 'funding' && <FundingFields pricingMode={pricingMode} />}
                {tab === 'files' && (
                  proposalId
                    ? <ProposalMediaManager proposalId={proposalId} />
                    : <p className="text-muted-foreground text-sm">Save the proposal first to attach files.</p>
                )}
              </motion.div>
            )
          })}
        </Card>

        {form.formState.errors.root && (
          <div className="mt-3 text-red-500">
            {JSON.stringify(form.formState.errors, null, 2)}
          </div>
        )}
      </div>
    </form>
  )
}
