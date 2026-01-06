import { useQuery } from '@tanstack/react-query'
import { listAccounts } from '../../client'

export function useGetAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data } = await listAccounts()

      return data
    },
  })
}
