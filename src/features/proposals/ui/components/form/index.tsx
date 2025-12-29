'use client'

import type { ProposalFormValues } from '@/features/proposals/schemas/form-schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Form } from '@/shared/components/ui/form'
import { defaultValues, proposalFormSchema } from '@/features/proposals/schemas/form-schema'
import { FundingFields } from './funding-fields'
import { HomeownerFields } from './homeowner-fields'
import { ProjectFields } from './project-fields'

export function ProposalForm() {
  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalFormSchema),
    mode: 'onSubmit',
    defaultValues,
  })

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
      </form>
    </Form>
  )
}
