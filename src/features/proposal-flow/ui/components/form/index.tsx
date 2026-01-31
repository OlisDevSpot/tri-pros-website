'use client'

import type { ProposalFormValues } from '@/features/proposal-flow/schemas/form-schema'
import { LockIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useFormContext } from 'react-hook-form'
import { toast } from 'sonner'
import { useSession } from '@/shared/auth/client'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { ROOTS } from '@/shared/config/roots'
import { useCreateProposal } from '@/shared/dal/client/proposals/mutations/use-create-proposal'
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

export function ProposalForm({ overrideValues }: Props) {
  const form = useFormContext<ProposalFormValues>()
  const createProposal = useCreateProposal()
  const { data: session } = useSession()
  const router = useRouter()

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
        form.setValue('homeowner.age', overrideValues.homeowner.age || 0)
        form.setValue('homeowner.hubspotVid', overrideValues.homeowner.hubspotVid || '')
      }

      if (overrideValues.project) {
        form.setValue('project.label', overrideValues.project.label || '')
        form.setValue('project.type', overrideValues.project.type || 'general-remodeling')
        form.setValue('project.timeAllocated', overrideValues.project.timeAllocated || '')
        form.setValue('project.agreementNotes', overrideValues.project.agreementNotes || '')
      }

      if (overrideValues.funding) {
        form.setValue('funding.tcp', overrideValues.funding.tcp || 0)
        form.setValue('funding.depositAmount', overrideValues.funding.depositAmount || 0)
        form.setValue('funding.cashInDeal', overrideValues.funding.cashInDeal || 0)
      }
    }
  }, [form, overrideValues])

  function onSubmit(data: ProposalFormValues) {
    console.log({ data })

    createProposal.mutate({
      label: data.project.label,
      ownerId: session?.user.id || 'c497d366-7c0a-4ae8-8bf3-d0ab0ed50b38',

      // HOMEOWNER
      firstName: data.homeowner.firstName,
      lastName: data.homeowner.lastName,
      email: data.homeowner.email,
      phoneNum: data.homeowner.phone,
      address: data.homeowner.address,
      city: data.homeowner.city,
      state: data.homeowner.state,
      zipCode: data.homeowner.zipCode,
      customerAge: data.homeowner.age,

      // PROJECT
      projectType: data.project.type,
      timeAllocated: data.project.timeAllocated,
      agreementNotes: data.project.agreementNotes,

      // FUNDING
      tcp: data.funding.tcp,
      depositAmount: data.funding.depositAmount,
      cashInDeal: data.funding.cashInDeal,

      // HUBSPOT
      hubspotContactVid: data.homeowner.hubspotVid,
    }, {
      onSuccess: (data) => {
        toast.success('Proposal created!')
        // form.reset()
        router.push(`${ROOTS.proposalFlow()}/proposal/${data.id}`)
      },
      onError: (error) => {
        toast.error(error.message)
      },
    })
  }

  const onInvalid = (errors: any) => {
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
              <LockIcon className="w-4 h-4" />
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
      <Button
        type="button"
        disabled={createProposal.isPending}
      >
        Save
      </Button>
      <Button
        type="submit"
        disabled={createProposal.isPending}
      >
        Update & Preview
      </Button>
    </form>
  )
}
