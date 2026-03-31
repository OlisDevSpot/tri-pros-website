'use client'

import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { OverrideProposalValues } from '@/features/proposal-flow/types'
import { motion } from 'motion/react'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { useEffect, useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { baseDefaultValues } from '@/features/proposal-flow/schemas/form-schema'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { FundingFields } from './funding-fields'
import { GeneralFields } from './general-fields'
import { ProjectFields } from './project-fields'

const FORM_TABS = ['general', 'sow', 'funding'] as const
type FormTab = (typeof FORM_TABS)[number]

const TAB_LABELS: Record<FormTab, string> = {
  funding: 'Funding',
  general: 'General',
  sow: 'Scope of Work',
}

interface Props {
  onSubmit: (data: ProposalFormSchema) => void
  isLoading: boolean
  initialValues?: OverrideProposalValues
  hideSubmitButton?: boolean
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

export function ProposalForm({ isLoading, onSubmit, initialValues, hideSubmitButton }: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const [proposalId] = useQueryState('proposalId')
  const [nuqsTab, setNuqsTab] = useQueryState(
    'formTab',
    parseAsStringLiteral(FORM_TABS).withDefault('general'),
  )
  const [activeTab, setActiveTab] = useState<FormTab>(nuqsTab)
  const pricingMode = useWatch({ control: form.control, name: 'meta.pricingMode' })

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

  return (
    <form
      id="proposal-form"
      onSubmit={form.handleSubmit(onSubmit, onInvalid)}
      className="flex h-full w-full flex-col gap-4"
    >
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full shrink-0"
      >
        <div className="flex justify-center">
          <TabsList>
            {FORM_TABS.map(tab => (
              <TabsTrigger key={tab} value={tab}>
                {TAB_LABELS[tab]}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Card className="w-full">
          <CardContent className="p-3 lg:p-6">
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
                </motion.div>
              )
            })}
          </CardContent>
        </Card>

        {form.formState.errors.root && (
          <div className="mt-4 text-red-500">
            {JSON.stringify(form.formState.errors, null, 2)}
          </div>
        )}
        {!hideSubmitButton && (
          <div className="mt-4 flex items-center gap-2">
            <Button type="submit" disabled={isLoading}>
              {proposalId ? 'Update & Preview' : 'Save & Preview'}
            </Button>
          </div>
        )}
      </div>
    </form>
  )
}
