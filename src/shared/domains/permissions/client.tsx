'use client'

import type { PackRule } from '@casl/ability/extra'

import type { UserRole } from '@/shared/constants/enums'
import type { AppAbility, PermissionRule, StockAbility } from '@/shared/domains/permissions/types'

import { unpackRules } from '@casl/ability/extra'
import { AbilityProvider as StockAbilityProvider, useAbility as useStockAbility } from '@casl/react'
import { skipToken, useQuery } from '@tanstack/react-query'
import { useDeferredValue, useMemo, useState } from 'react'

import { useSession } from '@/shared/domains/auth/client'
import { abilityFromRules } from '@/shared/domains/permissions/abilities'
import { useTRPC } from '@/trpc/helpers'

interface SignedInUser {
  id: string
  role: UserRole
}

type AbilityProviderProps = { children: React.ReactNode } & (
  // From a server boundary that read the session: its user, and the rules the server built for them.
  | { user: SignedInUser | null, rules: PackRule<PermissionRule>[] }
  // Nothing was read on the server (a static page): the rules are fetched once the browser knows who is signed in.
  | { user?: undefined, rules?: undefined }
)

/**
 * Provides the viewer's ability. The rules always come from the server: from the `rules` prop while
 * the browser's session read agrees with the server's `user`, from a query once it does not.
 */
export function AbilityProvider({ user, rules, children }: AbilityProviderProps) {
  const session = useSession()
  const [known, setKnown] = useState<SignedInUser | null>(user ?? null)

  // `isPending` is not "first read": better-auth raises it again on every refetch while its data is
  // null, so after a sign-out it would bring the server's user back. And a 5xx or network failure
  // settles with null data, which is not a sign-out. So the last settled answer is kept: the
  // server's until the first read lands, then each successful or 401 read, never a failed one.
  const readFailed = session.error != null && session.error.status !== 401
  if (!session.isPending && !readFailed) {
    const read = session.data?.user ?? null
    if (read?.id !== known?.id || read?.role !== known?.role) {
      setKnown(read ? { id: read.id, role: read.role } : null)
    }
  }

  const isServerUser = rules !== undefined && known?.id === user?.id && known?.role === user?.role

  const trpc = useTRPC()
  const fetched = useQuery(trpc.permissionsRouter.rules.queryOptions(
    known && !isServerUser ? { userId: known.id, role: known.role } : skipToken,
    { staleTime: Infinity },
  ))

  const packed = isServerUser ? rules : known ? fetched.data : undefined

  // A context change that lands right after hydration reaches every Suspense boundary still
  // hydrating below, and React drops the server HTML of any that waits on data and shows its
  // fallback. Deferred, the change waits for those boundaries to hydrate.
  const settled = useDeferredValue(packed)
  const ability = useMemo(() => abilityFromRules(settled ? unpackRules(settled) : []), [settled])

  return (
    <StockAbilityProvider value={ability}>
      {children}
    </StockAbilityProvider>
  )
}

/** The viewer's ability. Its `can` and `cannot` are typed from the specs. */
export function useAbility(): AppAbility {
  return useStockAbility<StockAbility>()
}
