import type { SearchParams } from 'nuqs/server'

import { RecordsPageMotionShell } from '@/shared/components/records-page-motion-shell'
import { loadPaginatedQueryInput } from '@/shared/dal/server/lib/query/load-paginated-query-input'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'
import { CustomersTable } from '@/shared/entities/customers/components/customers-table'
import { CUSTOMERS_TABLE_QUERY_CONFIG } from '@/shared/entities/customers/constants/customers-table-query-config'
import { HydrateClient } from '@/trpc/components/hydrate-client'
import { prefetch } from '@/trpc/lib/prefetch'
import { trpc } from '@/trpc/server'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<SearchParams>
}

export default async function CustomersPage({ searchParams }: Props) {
  const authState = await protectDashboardPage()

  // Unauthenticated visitors get the layout's sign-in screen; skip the
  // prefetch work.
  if (authState.status === 'authenticated') {
    const input = await loadPaginatedQueryInput(searchParams, CUSTOMERS_TABLE_QUERY_CONFIG)
    prefetch(trpc.customersRouter.business.list.queryOptions(input))
  }

  return (
    <HydrateClient>
      <RecordsPageMotionShell>
        <CustomersTable />
      </RecordsPageMotionShell>
    </HydrateClient>
  )
}
