'use client'

import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { SOW } from '@/shared/types/sow'
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
import { SpinnerLoader2 } from '@/shared/components/loaders/spinner-loader-2'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Form } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { ROOTS } from '@/shared/config/roots'
import { useCreateProposal } from '@/shared/dal/client/proposals/mutations/use-create-proposal'
import { pageToContact } from '@/shared/services/notion/lib/contacts/adapter'
import { useTRPC } from '@/trpc/helpers'

export function CreateNewProposalView() {
  const [query, setQuery] = useQueryState('q', { defaultValue: '' })
  const [lastContactId, setLastContactId] = useQueryState('last-contact-id', { defaultValue: '' })
  const trpc = useTRPC()
  const { data: session } = useSession()
  const router = useRouter()
  const createProposal = useCreateProposal()

  const notionContactQuery = useQuery(trpc.notionRouter.contacts.getByQuery.queryOptions({
    query,
    filterProperty: 'name',
  }, {
    enabled: false,
  }))
  const notionContactById = useQuery(trpc.notionRouter.contacts.getSingleById.queryOptions({
    id: lastContactId,
  }, {
    enabled: false,
  }))

  const form = useForm<ProposalFormSchema>({
    resolver: zodResolver(proposalFormSchema),
    mode: 'onSubmit',
    defaultValues: baseDefaultValues,
    disabled: notionContactQuery.isLoading,
  })

  const searchInputRef = useRef<HTMLInputElement>(null)

  const contactProperties = useMemo(() => {
    return {
      mostLikelyProperties: notionContactQuery.data?.properties,
      allMatches: notionContactQuery.data?.allPages,
    }
  }, [notionContactQuery.data])

  const initProposalValues = useMemo(() => {
    if (notionContactQuery.data) {
      const data: Partial<ProposalFormSchema> = {
        project: {
          label: `${contactProperties?.mostLikelyProperties?.name || ''}`.trim() || '',
          address: contactProperties?.mostLikelyProperties?.address || '',
          city: contactProperties?.mostLikelyProperties?.city || '',
          state: contactProperties?.mostLikelyProperties?.state || '',
          zipCode: contactProperties?.mostLikelyProperties?.zip || '',
          sow: [],
          timeAllocated: '4 weeks',
          agreementNotes: '',
          projectType: 'general-remodeling',
        },
        homeowner: {
          name: contactProperties?.mostLikelyProperties?.name || '',
          email: contactProperties?.mostLikelyProperties?.email || '',
          phoneNum: contactProperties?.mostLikelyProperties?.phone || '',
          customerAge: 0,
        },
      }

      return data
    }
  }, [contactProperties, notionContactQuery.data])

  function onSubmit(data: ProposalFormSchema) {
    // eslint-disable-next-line no-console
    console.log(data)

    const sow = data.project.sow.map(({ title, scopes, trade, html }) => {
      if (!trade) {
        return undefined
      }

      return {
        title,
        scopes,
        trade,
        html,
      }
    }).filter(
      (item): item is SOW =>
        item !== undefined,
    )

    createProposal.mutate({
      label: data.project.label,
      ownerId: session?.user.id || 'c497d366-7c0a-4ae8-8bf3-d0ab0ed50b38',

      // HOMEOWNER
      name: data.homeowner.name,
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
      sow,

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
            setQuery(e.target.value)
          }}
          className="max-w-50"
        />
        <Button
          onClick={() => {
            notionContactQuery
              .refetch()
              .then(({ data }) => {
                setLastContactId(data?.id || '')
              })
              .finally(() => {
                searchInputRef.current?.focus()
              })
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
            setQuery('')
            setLastContactId('')
            searchInputRef.current?.focus()
          }}
        >
          <XIcon />
        </Button>
        <div>
          { notionContactQuery.isLoading && !notionContactQuery.data
            ? <SpinnerLoader2 size={16} />
            : (notionContactQuery.data?.allPages && notionContactQuery.data.allPages.length > 0 && (
                <div className="flex flex-row gap-2">
                  { notionContactQuery.data!.allPages.map(page => (
                    <div
                      key={page.id}
                    >
                      <Badge
                        variant={lastContactId === page.id ? 'default' : 'outline'}
                        className="cursor-pointer text-sm"
                        onClick={() => {
                          setLastContactId(page.id)
                          notionContactById
                            .refetch()
                        }}
                      >
                        {pageToContact(page).name}
                      </Badge>
                    </div>
                  ))}
                </div>
              ))}

        </div>
      </div>
      <div
        className="h-full w-full overflow-auto pr-4"
      >
        <Form {...form}>
          <ProposalForm
            isLoading={notionContactQuery.isLoading}
            initialValues={initProposalValues}
            onSubmit={onSubmit}
          />
        </Form>
      </div>
    </motion.div>
  )
}
