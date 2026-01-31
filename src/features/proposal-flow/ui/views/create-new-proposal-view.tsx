'use client'

import type { ProposalFormValues } from '@/features/proposal-flow/schemas/form-schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { XIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useQueryState } from 'nuqs'
import { useMemo, useRef } from 'react'

import { useForm } from 'react-hook-form'

import { baseDefaultValues, proposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'

import { ProposalForm } from '@/features/proposal-flow/ui/components/form'
import { Button } from '@/shared/components/ui/button'
import { Form } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { useTRPC } from '@/trpc/helpers'

export function CreateNewProposalView() {
  const [query, setQuery] = useQueryState('q', { defaultValue: '' })
  const [searchQuery, setSearchQuery] = useQueryState('last-search', { defaultValue: '' })
  const trpc = useTRPC()

  const contactQuery = useQuery(trpc.hubspotRouter.getContactByQuery.queryOptions({
    query: searchQuery,
  }, {
    enabled: !!searchQuery,
  }))

  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalFormSchema),
    mode: 'onSubmit',
    defaultValues: baseDefaultValues,
    disabled: contactQuery.isLoading,
  })

  const searchInputRef = useRef<HTMLInputElement>(null)

  function searchForContact(query: string) {
    setSearchQuery(query)
  }

  const contactProperties = contactQuery.data?.contacts[0].properties

  const currentProposalValues = useMemo(() => {
    if (contactQuery.data) {
      return {
        project: {
          label: `${contactProperties?.firstname.value || ''} ${contactProperties?.lastname.value || ''}`.trim() || '',
        },
        homeowner: {
          firstName: contactProperties?.firstname.value || '',
          lastName: contactProperties?.lastname.value || '',
          email: contactProperties?.email?.value || '',
          phone: contactProperties?.phone?.value || '',
          address: contactProperties?.address?.value || '',
          city: contactProperties?.city?.value || '',
          state: contactProperties?.state?.value || '',
          zipCode: contactProperties?.zip?.value || '',
          hubspotVid: String(contactQuery.data?.contacts[0].vid),
        },
      }
    }
  }, [contactProperties, contactQuery.data])

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
          onChange={e => setQuery(e.target.value)}
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
            setSearchQuery('')
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
            isLoading={contactQuery.isLoading}
            overrideValues={currentProposalValues}
          />
        </Form>
      </div>
    </motion.div>
  )
}
