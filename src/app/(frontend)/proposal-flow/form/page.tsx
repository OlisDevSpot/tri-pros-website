'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ProposalForm } from '@/features/proposals/ui/components/form'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { useTRPC } from '@/trpc/helpers'

export default function ProposalFormPage() {
  const [query, setQuery] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const trpc = useTRPC()
  const contactQuery = useQuery(trpc.hubspotRouter.getContactByQuery.queryOptions({
    query: searchQuery,
  }, {
    enabled: !!searchQuery,
  }))

  function searchForContact(query: string) {
    setSearchQuery(query)
  }

  const contactProperties = contactQuery.data?.contacts[0].properties

  if (contactQuery.data) {
    // eslint-disable-next-line no-console
    console.log(contactQuery.data)
  }

  return (
    <div className="container h-full flex flex-col gap-4">
      <div className="flex justify-center items-center gap-4 shrink-0">
        <Input
          type="text"
          placeholder="Search contact"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <Button onClick={() => {
          searchForContact(query)
        }}
        >
          Search
        </Button>
      </div>
      <div
        className="h-full overflow-auto"
      >
        <ProposalForm
          isLoading={contactQuery.isLoading}
          overrideValues={{
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
            },
          }}
        />
      </div>
    </div>
  )
}
