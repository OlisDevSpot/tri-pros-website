'use client'

import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { SOW } from '@/shared/entities/proposals/types'
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
import { homeownerSectionSchema, projectSectionSchema } from '@/shared/entities/proposals/schemas'
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
        project: projectSectionSchema.parse({
          data: {
            ...baseDefaultValues.project.data,
            address: contactProperties?.mostLikelyProperties?.address || '',
            city: contactProperties?.mostLikelyProperties?.city || '',
            state: contactProperties?.mostLikelyProperties?.state || '',
            zip: contactProperties?.mostLikelyProperties?.zip || '',
            label: `${contactProperties?.mostLikelyProperties?.name || ''}`.trim() || '',
          },
          meta: {
            enabled: true,
          },
        }),
        homeowner: homeownerSectionSchema.parse({
          data: {
            ...baseDefaultValues.homeowner.data,
            name: contactProperties?.mostLikelyProperties?.name || '',
            email: contactProperties?.mostLikelyProperties?.email || '',
            phoneNum: contactProperties?.mostLikelyProperties?.phone || '',
            age: 0,
          },
          meta: {
            enabled: true,
          },
        }),
      }

      return data
    }
  }, [contactProperties, notionContactQuery.data])

  function onSubmit(data: ProposalFormSchema) {
    // eslint-disable-next-line no-console
    console.log(data)

    const sow = data.project.data.sow.map((singleSOW) => {
      if (!singleSOW.trade) {
        return undefined
      }

      return singleSOW
    }).filter(
      (item): item is SOW =>
        item !== undefined,
    )

    const totalProjectDiscounts = data.funding.data.incentives.reduce((acc, cur) => {
      if (cur.type === 'discount') {
        return acc + cur.amount
      }

      return acc
    }, 0)

    createProposal.mutate({
      label: data.project.data.label,
      ownerId: session?.user.id || 'c497d366-7c0a-4ae8-8bf3-d0ab0ed50b38',

      homeownerJSON: data.homeowner,
      projectJSON: {
        data: {
          ...data.project.data,
          sow,
        },
        meta: data.project.meta,
      },
      fundingJSON: {
        data: {
          ...data.funding.data,
          cashInDeal: data.funding.data.startingTcp - totalProjectDiscounts,
          finalTcp: data.funding.data.startingTcp - totalProjectDiscounts,
        },
        meta: data.funding.meta,
      },
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
      className="w-full h-full flex flex-col gap-4 min-h-0"
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
                          notionContactById.refetch()
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
      <div className="flex-1 min-h-0 w-full overflow-auto pr-4">
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
