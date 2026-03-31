'use client'

import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { OverrideProposalValues } from '@/features/proposal-flow/types'
import { AnimatePresence, motion } from 'motion/react'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { useEffect, useRef } from 'react'
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

const TRANSITION = { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] } as const

const slideVariants = {
  center: {
    x: 0,
    opacity: 1,
  },
  enter: (direction: number) => ({
    x: direction > 0 ? 100 : -100,
    opacity: 0,
  }),
  exit: (direction: number) => ({
    x: direction > 0 ? -100 : 100,
    opacity: 0,
  }),
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
  const [activeTab, setActiveTab] = useQueryState(
    'formTab',
    parseAsStringLiteral(FORM_TABS).withDefault('general'),
  )
  const pricingMode = useWatch({ control: form.control, name: 'meta.pricingMode' })

  const prevTabRef = useRef(FORM_TABS.indexOf(activeTab))
  const currentIndex = FORM_TABS.indexOf(activeTab)
  const direction = currentIndex - prevTabRef.current

  useEffect(() => {
    prevTabRef.current = currentIndex
  }, [currentIndex])

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
      className="flex w-full flex-col gap-6"
    >
      <Tabs
        value={activeTab}
        onValueChange={val => setActiveTab(val as FormTab)}
        className="w-full"
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

      <Card className="w-full overflow-hidden">
        <CardContent className="p-3 lg:p-6">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={activeTab}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={TRANSITION}
            >
              {activeTab === 'general' && <GeneralFields />}
              {activeTab === 'sow' && <ProjectFields pricingMode={pricingMode} />}
              {activeTab === 'funding' && <FundingFields pricingMode={pricingMode} />}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>

      {form.formState.errors.root && (
        <div className="text-red-500">
          {JSON.stringify(form.formState.errors, null, 2)}
        </div>
      )}
      {!hideSubmitButton && (
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={isLoading}>
            {proposalId ? 'Update & Preview' : 'Save & Preview'}
          </Button>
        </div>
      )}
    </form>
  )
}
