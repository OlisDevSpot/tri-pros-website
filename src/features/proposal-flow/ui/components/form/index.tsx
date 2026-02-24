'use client'

import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { Settings2Icon } from 'lucide-react'
import { useQueryState } from 'nuqs'
import { useEffect } from 'react'
import { useFormContext } from 'react-hook-form'
import { toast } from 'sonner'
import { baseDefaultValues } from '@/features/proposal-flow/schemas/form-schema'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { FundingFields } from './funding-fields'
import { HomeownerFields } from './homeowner-fields'
import { ProjectFields } from './project-fields'

interface Props {
  onSubmit: (data: ProposalFormSchema) => void
  isLoading: boolean
  initialValues?: {
    homeowner?: Partial<ProposalFormSchema['homeowner']>
    project?: Partial<ProposalFormSchema['project']>
    funding?: Partial<ProposalFormSchema['funding']>
  }
}

function deepMergeDefaults(base: ProposalFormSchema, override: Props['initialValues'] = {}): ProposalFormSchema {
  if (Object.keys(override).length === 0) {
    return base
  }

  const defaultWithOverrides = {
    ...base,
    homeowner: { ...base.homeowner, ...(override.homeowner ?? {}) },
    project: { ...base.project, ...(override.project ?? {}) },
    funding: { ...base.funding, ...(override.funding ?? {}) },
  }

  return defaultWithOverrides
}

export function ProposalForm({ isLoading, onSubmit, initialValues }: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const [proposalId] = useQueryState('proposalId')

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
      onSubmit={form.handleSubmit(onSubmit, onInvalid)}
      className="space-y-8 w-full h-auto"
    >
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center gap-4">
            <FormField
              name="project.label"
              control={form.control}
              render={({ field }) => (
                <FormItem className="flex items-center">
                  <FormLabel className="shrink-0">
                    <h2>Project Name:</h2>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="John Doe"
                      {...field}
                      className="bg-transparent dark:bg-transparent border-none"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CardHeader>
        <CardHeader>
          <CardTitle>Homeowner Information</CardTitle>
          <CardDescription>Homeowner information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <HomeownerFields />
        </CardContent>
        <CardHeader>
          <CardTitle>Project Information</CardTitle>
          <CardDescription>Information relevant to the project success</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <ProjectFields />
        </CardContent>
        <CardHeader>
          <div className="flex gap-2 items-center">
            <CardTitle>Funding Information</CardTitle>
            <Button
              type="button"
              size="icon"

            >
              <Settings2Icon className="w-4 h-4" />
            </Button>
          </div>
          <CardDescription>Information relevant to increased financial responsibility</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <FundingFields />
        </CardContent>
      </Card>

      {form.formState.errors.root && (
        <div>
          <div className="text-red-500">{JSON.stringify(form.formState.errors, null, 2)}</div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button
          type="submit"
          disabled={isLoading}
        >
          {proposalId ? 'Update & Preview' : 'Save & Preview'}
        </Button>
      </div>
    </form>
  )
}
