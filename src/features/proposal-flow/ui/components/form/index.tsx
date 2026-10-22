'use client'

import type { FormPartId } from '@/features/proposal-flow/constants/form-parts'
import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { OverrideProposalValues } from '@/features/proposal-flow/types'
import { SaveIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { FORM_PART_IDS, FORM_PARTS } from '@/features/proposal-flow/constants/form-parts'
import { useFormPart } from '@/features/proposal-flow/hooks/use-form-part'
import { useProposalFormActions } from '@/features/proposal-flow/hooks/use-proposal-form-actions'
import { deepMergeFormDefaults } from '@/features/proposal-flow/lib/deep-merge-form-defaults'
import { baseDefaultValues } from '@/features/proposal-flow/schemas/form-schema'
import { ProposalToolbar } from '@/features/proposal-flow/ui/components/edit-page/proposal-toolbar'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { FundingFields } from './funding-fields'
import { GeneralFields } from './general-fields'
import { ProjectFields } from './project-fields'
import { ProposalMediaManager } from './proposal-media-manager'

interface Props {
  onSubmit: (data: ProposalFormSchema) => void
  onSave?: (data: ProposalFormSchema) => void
  isLoading: boolean
  initialValues?: OverrideProposalValues
  viewHref?: string
  proposalId?: string
}

export function ProposalForm({ isLoading, onSubmit, onSave, initialValues, viewHref, proposalId }: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const { activePart, setPart } = useFormPart()
  const actions = useProposalFormActions({ onSubmit, onSave })
  const isEditMode = !!onSave
  const pricingMode = useWatch({ control: form.control, name: 'priceDisplayMode' })

  useEffect(() => {
    if (initialValues) {
      form.reset(deepMergeFormDefaults(baseDefaultValues, initialValues))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues])

  return (
    <form
      id="proposal-form"
      onSubmit={(event) => {
        event.preventDefault()
        actions.saveAndPreview()
      }}
      className="flex h-full w-full flex-col gap-3"
    >
      <div className="flex shrink-0 items-center justify-between gap-2">
        <Tabs
          value={activePart}
          onValueChange={val => setPart(val as FormPartId)}
        >
          <TabsList>
            {FORM_PARTS.map(part => (
              <TabsTrigger key={part.id} value={part.id}>
                {part.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {isEditMode
          ? <ProposalToolbar isLoading={isLoading} viewHref={viewHref ?? ''} actions={actions} />
          : (
              <Button
                type="button"
                size="sm"
                disabled={isLoading}
                onClick={actions.saveAndPreview}
              >
                <SaveIcon className="size-3.5" />
                Save & Preview
              </Button>
            )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-gutter-stable">
        <Card className="w-full p-3 lg:p-5">
          {FORM_PART_IDS.map((tab) => {
            const isActive = activePart === tab
            return (
              <motion.div
                key={tab}
                animate={{ opacity: isActive ? 1 : 0 }}
                transition={{ duration: 0.15 }}
                className={isActive ? '' : 'hidden'}
              >
                {tab === 'general' && <GeneralFields withName />}
                {tab === 'sow' && <ProjectFields priceDisplayMode={pricingMode} />}
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
          <div className="mt-3 text-destructive-text">
            {JSON.stringify(form.formState.errors, null, 2)}
          </div>
        )}
      </div>
    </form>
  )
}
