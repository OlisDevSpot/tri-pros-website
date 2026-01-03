import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/helpers'

export function useHubspotContact({ contactId, enabled }: { contactId: string, enabled: boolean }) {
  const trpc = useTRPC()
  return useQuery(trpc.hubspotRouter.getContact.queryOptions({
    contactId,
  }, {
    enabled,
  }))
}
