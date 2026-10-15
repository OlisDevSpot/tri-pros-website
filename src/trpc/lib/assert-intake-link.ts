import type { AppAbility } from '@/shared/domains/permissions/types'

import { TRPCError } from '@trpc/server'

import { getActiveLeadSourceByLink } from '@/shared/entities/lead-sources/dal/server/queries'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'

const INVALID_LINK = 'This intake link is no longer valid. Ask for a new one.'

/**
 * A lead source's link is its credential, so the write checks it, not only the page that shows the form.
 * The office files leads from the dashboard without a link; only the office files one under `manual`.
 */
export async function assertIntakeLink(ability: AppAbility, link: { leadSourceSlug?: string, token?: string }): Promise<void> {
  if (ability.can('manage', 'all')) {
    return
  }
  const { leadSourceSlug, token } = link
  if (!leadSourceSlug || !token || leadSourceSlug === 'manual') {
    throw new TRPCError({ code: 'NOT_FOUND', message: INVALID_LINK })
  }
  if (!dalToTrpc(await getActiveLeadSourceByLink(leadSourceSlug, token))) {
    throw new TRPCError({ code: 'NOT_FOUND', message: INVALID_LINK })
  }
}
