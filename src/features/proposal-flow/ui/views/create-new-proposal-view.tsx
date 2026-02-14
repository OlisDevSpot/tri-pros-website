'use client'

import type { ProposalFormValues } from '@/features/proposal-flow/schemas/form-schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { XIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useQueryState } from 'nuqs'
import { useMemo, useRef } from 'react'

import { useForm } from 'react-hook-form'

import { toast } from 'sonner'

import { baseDefaultValues, proposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { ProposalForm } from '@/features/proposal-flow/ui/components/form'
import { useSession } from '@/shared/auth/client'
import { Button } from '@/shared/components/ui/button'
import { Form } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { ROOTS } from '@/shared/config/roots'
import { useCreateProposal } from '@/shared/dal/client/proposals/mutations/use-create-proposal'
import { useTRPC } from '@/trpc/helpers'

export function CreateNewProposalView() {
  const [query, setQuery] = useQueryState('q', { defaultValue: '' })
  const [lastQuery, setLastQuery] = useQueryState('last-query', { defaultValue: '' })
  const trpc = useTRPC()
  const { data: session } = useSession()
  const router = useRouter()
  const createProposal = useCreateProposal()

  const hubspotContactQuery = useQuery(trpc.hubspotRouter.getContactByQuery.queryOptions({
    query: lastQuery,
  }, {
    enabled: !!lastQuery,
  }))

  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalFormSchema),
    mode: 'onSubmit',
    defaultValues: baseDefaultValues,
    disabled: hubspotContactQuery.isLoading,
  })

  const searchInputRef = useRef<HTMLInputElement>(null)

  function searchForContact(query: string) {
    setLastQuery(query)
  }

  const contactProperties = hubspotContactQuery.data?.contacts[0].properties

  const currentProposalValues = useMemo(() => {
    if (hubspotContactQuery.data) {
      const data: Partial<ProposalFormValues> = {
        project: {
          label: `${contactProperties?.firstname.value || ''} ${contactProperties?.lastname.value || ''}`.trim() || '',
          address: contactProperties?.address?.value || '',
          city: contactProperties?.city?.value || '',
          state: contactProperties?.state?.value || '',
          zipCode: contactProperties?.zip?.value || '',
          scopes: [],
          timeAllocated: '4 weeks',
          agreementNotes: '',
          projectType: 'general-remodeling',
        },
        homeowner: {
          firstName: contactProperties?.firstname.value || '',
          lastName: contactProperties?.lastname.value || '',
          email: contactProperties?.email?.value || '',
          phoneNum: contactProperties?.phone?.value || '',
          hubspotContactVid: String(hubspotContactQuery.data?.contacts[0].vid),
          customerAge: 0,
        },
      }

      return data
    }
  }, [contactProperties, hubspotContactQuery.data])

  function handleHubspotSearch(_query: string) {
    // eslint-disable-next-line no-console
    console.log(contactProperties)
    // eslint-disable-next-line no-console
    console.log(hubspotContactQuery.data)
  }

  function onSubmit(data: ProposalFormValues) {
    createProposal.mutate({
      label: data.project.label,
      ownerId: session?.user.id || 'c497d366-7c0a-4ae8-8bf3-d0ab0ed50b38',

      // HOMEOWNER
      firstName: data.homeowner.firstName,
      lastName: data.homeowner.lastName,
      email: data.homeowner.email,
      phoneNum: data.homeowner.phoneNum,
      customerAge: data.homeowner.customerAge,

      // PROJECT
      address: data.project.address,
      city: data.project.city,
      state: data.project.state,
      zipCode: data.project.zipCode,
      projectType: data.project.projectType,
      timeAllocated: data.project.timeAllocated,
      agreementNotes: data.project.agreementNotes,

      // FUNDING
      tcp: data.funding.tcp,
      depositAmount: data.funding.depositAmount,
      cashInDeal: data.funding.cashInDeal,

      // HUBSPOT
      hubspotContactVid: data.homeowner.hubspotContactVid,
    }, {
      onSuccess: (data) => {
        toast.success('Proposal created!')
        router.push(`${ROOTS.proposalFlow()}/proposal/${data.id}`)
      },
      onError: (error) => {
        toast.error(error.message)
      },
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.25 }}
      className="w-full h-full flex flex-col gap-4"
    >
      <div className="flex justify-start items-center gap-2 shrink-0">
        <Input
          ref={searchInputRef}
          type="text"
          placeholder="Search contact"
          value={query}
          onChange={(e) => {
            handleHubspotSearch(query)
            setQuery(e.target.value)
          }}
          className="max-w-50"
        />
        <Button
          onClick={() => {
            searchForContact(query)
          }}
          type="button"
        >
          Search
        </Button>
        <Button
          size="icon"
          className="bg-destructive text-destructive-foreground hover:bg-destructive/80 hover:text-destructive-foreground/80"
          onClick={() => {
            form.reset()
            setLastQuery('')
            setQuery('')
            searchInputRef.current?.focus()
          }}
        >
          <XIcon />
        </Button>
      </div>
      <div
        className="h-full w-full overflow-auto pr-4"
      >
        <Form {...form}>
          <ProposalForm
            isLoading={hubspotContactQuery.isLoading}
            overrideValues={currentProposalValues}
            onSubmit={onSubmit}
          />
        </Form>
      </div>
    </motion.div>
  )
}
