import { useQueryClient } from '@tanstack/react-query'
import { FaHubspot } from 'react-icons/fa6'
import { oauth2, unlinkAccount, useSession } from '@/shared/auth/client'
import { useGetAccounts } from '@/shared/auth/hooks/queries/use-get-accounts'
import { SpinnerLoader2 } from '@/shared/components/loaders/spinner-loader-2'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface Props {
  onLinkAccount?: () => void
}

export function LinkHubspotButton({ onLinkAccount }: Props) {
  const queryClient = useQueryClient()
  const session = useSession()
  const accounts = useGetAccounts({ enabled: !!session?.data?.user })
  const hubspotAccountLinked = accounts.data?.find(account => account.providerId === 'hubspot')

  return (
    <Button
      onClick={hubspotAccountLinked
        ? async () => {
          await unlinkAccount({ providerId: 'hubspot' }, {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: ['accounts'] })
            },
          })
        }
        : async () => {
          await oauth2.link({
            providerId: 'hubspot',
            callbackURL: '/',
          }, {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: ['accounts'] })
            },
          })

          onLinkAccount?.()
        }}
      className={cn(
        'flex items-center gap-2 w-full',
        hubspotAccountLinked && 'text-destructive-foreground bg-destructive hover:bg-destructive/80 hover:text-destructive-foreground/80',
      )}
      disabled={accounts.isLoading}
    >
      <FaHubspot />
      {accounts.isLoading
        ? <SpinnerLoader2 />
        : (
            <span>
              {hubspotAccountLinked ? 'Unlink' : 'Link'}
              {' '}
              Hubspot
            </span>
          )}
    </Button>
  )
}
