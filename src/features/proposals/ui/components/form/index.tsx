'use client'

import type { ProposalFormValues } from '@/features/proposals/schemas/form-schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { baseDefaultValues, proposalFormSchema } from '@/features/proposals/schemas/form-schema'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { FundingFields } from './funding-fields'
import { HomeownerFields } from './homeowner-fields'
import { ProjectFields } from './project-fields'

interface Props {
  isLoading: boolean
  overrideValues?: {
    homeowner?: Partial<ProposalFormValues['homeowner']>
    project?: Partial<ProposalFormValues['project']>
    funding?: Partial<ProposalFormValues['funding']>
  }
}

export function ProposalForm({ isLoading, overrideValues }: Props) {
  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalFormSchema),
    mode: 'onSubmit',
    defaultValues: baseDefaultValues,
    disabled: isLoading,
  })

  useEffect(() => {
    if (overrideValues) {
      if (overrideValues.homeowner) {
        form.setValue('homeowner.firstName', overrideValues.homeowner.firstName || '')
        form.setValue('homeowner.lastName', overrideValues.homeowner.lastName || '')
        form.setValue('homeowner.email', overrideValues.homeowner.email || '')
        form.setValue('homeowner.phone', overrideValues.homeowner.phone || '')
        form.setValue('homeowner.address', overrideValues.homeowner.address || '')
        form.setValue('homeowner.city', overrideValues.homeowner.city || '')
        form.setValue('homeowner.state', overrideValues.homeowner.state || '')
        form.setValue('homeowner.zipCode', overrideValues.homeowner.zipCode || '')
      }

      if (overrideValues.project) {
        form.setValue('project.label', overrideValues.project.label || '')
        form.setValue('project.type', overrideValues.project.type || 'general-remodeling')
        form.setValue('project.timeAllocated', overrideValues.project.timeAllocated || '')
        form.setValue('project.sowSummary', overrideValues.project.sowSummary || '')
      }

      if (overrideValues.funding) {
        form.setValue('funding.tcp', overrideValues.funding.tcp || 0)
        form.setValue('funding.deposit', overrideValues.funding.deposit || 0)
        form.setValue('funding.totalCash', overrideValues.funding.totalCash || 0)
      }
    }
  }, [form, overrideValues])

  function onSubmit(data: ProposalFormValues) {
    // eslint-disable-next-line no-console
    console.log(data)
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
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
                      <h2>Project Name</h2>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
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
            <CardTitle>Funding Information</CardTitle>
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
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  )
}
