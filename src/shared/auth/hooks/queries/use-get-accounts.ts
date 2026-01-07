import { useQuery } from '@tanstack/react-query'
import { listAccounts } from '@/shared/auth/client'

interface Props {
  enabled?: boolean
}

export function useGetAccounts({ enabled }: Props = {}) {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data } = await listAccounts()

      return data
    },
    enabled,
  })
}
