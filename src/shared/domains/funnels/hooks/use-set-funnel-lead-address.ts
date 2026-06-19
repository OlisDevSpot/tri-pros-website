import { useMutation } from '@tanstack/react-query'

import { useTRPC } from '@/trpc/helpers'

interface SetAddressArgs {
  leadId: string
  address: string
  city: string
  state: string
  zip: string
}

/**
 * Best-effort address persist: never awaited, errors swallowed. Patching the
 * already-created funnel lead with its property address must never block or
 * break the funnel experience — the engine's shell "Next →" advances regardless.
 */
export function useSetFunnelLeadAddress() {
  const trpc = useTRPC()
  const mutation = useMutation(trpc.funnelsRouter.setFunnelLeadAddress.mutationOptions())
  return (args: SetAddressArgs) => {
    mutation.mutate(args, { onError: () => {} })
  }
}
