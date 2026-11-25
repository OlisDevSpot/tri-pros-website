'use client'

import type { FormPartId } from '@/features/proposal-flow/constants/form-parts'
import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { SaveIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useFormContext, useWatch } from 'react-hook-form'
import { FORM_PART_IDS, FORM_PARTS } from '@/features/proposal-flow/constants/form-parts'
import { useFormPart } from '@/features/proposal-flow/hooks/use-form-part'
import { useProposalFormActions } from '@/features/proposal-flow/hooks/use-proposal-form-actions'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { FundingFields } from './funding-fields'
import { GeneralFields } from './general-fields'
import { ProjectFields } from './project-fields'

interface Props {
  onSubmit: (data: ProposalFormSchema) => void
  isLoading: boolean
}

export function ProposalForm({ isLoading, onSubmit }: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const { activePart, setPart } = useFormPart()
  const actions = useProposalFormActions({ onSubmit })
  const pricingMode = useWatch({ control: form.control, name: 'priceDisplayMode' })

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

        <Button
          type="button"
          size="sm"
          disabled={isLoading}
          onClick={actions.saveAndPreview}
        >
          <SaveIcon className="size-3.5" />
          Save & Preview
        </Button>
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
                  <p className="text-muted-foreground text-sm">Save the proposal first to attach files.</p>
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
