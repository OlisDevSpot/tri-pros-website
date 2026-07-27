'use client'

import type { LeadsTableMeta, LeadTableRow } from '@/features/campaigns-admin/ui/lib/leads-columns'
import type { CampaignLeadRow } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'

import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'

import { CAMPAIGN_LEADS_TABLE_QUERY_CONFIG } from '@/features/campaigns-admin/constants/campaign-leads-table-query-config'
import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { buildLeadsFilterConfig } from '@/features/campaigns-admin/lib/build-leads-filter-config'
import { LeadDrawer } from '@/features/campaigns-admin/ui/components/leads/lead-drawer'
import { LeadsBulkActionBar } from '@/features/campaigns-admin/ui/components/leads/leads-bulk-action-bar'
import { LeadsFilterBar } from '@/features/campaigns-admin/ui/components/leads/leads-filter-bar'
import { buildLeadsColumns } from '@/features/campaigns-admin/ui/lib/leads-columns'
import { toDataTablePagination } from '@/shared/components/data-table/lib/to-data-table-pagination'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { usePaginatedQuery } from '@/shared/dal/client/hooks/use-paginated-query'
import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { useTRPC } from '@/trpc/helpers'

// `DataTable` requires `TData extends { id: string }`. `CampaignLeadRow` uses
// `customerId` as its PK, so we spread `id: customerId` before passing rows
// to the table. All column cell accessors still reference `row.original.customerId`.
function toTableRow(row: CampaignLeadRow): LeadTableRow {
  return { ...row, id: row.customerId }
}

export function CampaignsLeadsView() {
  const trpc = useTRPC()
  const { enroll } = useCampaignMutations()
  const { open: openModal, setModal } = useModalStore()

  const summariesQuery = useQuery(trpc.voipCampaignsRouter.getSourceCampaignSummaries.queryOptions())
  const campaignsQuery = useQuery(trpc.voipCampaignsRouter.listCampaigns.queryOptions())
  const campaigns = useMemo(() => campaignsQuery.data ?? [], [campaignsQuery.data])

  const filterConfig = useMemo(
    () =>
      buildLeadsFilterConfig({
        campaigns: campaigns.map(c => ({
          label: c.ctCampaignName,
          value: c.id,
        })),
        sources: (summariesQuery.data ?? []).map(s => ({
          label: s.name,
          value: s.sourceSlug,
        })),
      }),
    [campaigns, summariesQuery.data],
  )

  // `listLeads.queryOptions` narrows `filters` to its literal enum shape, but
  // `usePaginatedQuery` always supplies `Record<string, FilterValue>` — the
  // shapes are structurally compatible at runtime. Cast via `never` so
  // TypeScript accepts the factory signature without a bare `any` annotation.
  //
  // Hook input is the STATIC config only — `sourceSlug`/`campaignId` carry
  // `options: []` there, so their URL parsing stays free-string-stable
  // across the whole session regardless of `summariesQuery`/`campaignsQuery`
  // load state (see the config file's doc comment). The runtime-merged
  // `filterConfig` (populated options) is spread onto a toolbar-only view of
  // `pagination` below — never fed back into the hook.
  const pagination = usePaginatedQuery<Record<string, never>, CampaignLeadRow>(
    trpc.voipCampaignsRouter.listLeads.queryOptions as never,
    {},
    CAMPAIGN_LEADS_TABLE_QUERY_CONFIG,
  )

  // Toolbar-only view: same pagination state/setters, but `filterDefinitions`
  // swapped for the runtime-merged (populated-options) config so the
  // filter UI can render real campaign/source choices. `usePaginatedQuery`
  // itself never sees this — only `<LeadsFilterBar>` does.
  const toolbarPagination = useMemo(
    () => ({ ...pagination, filterDefinitions: filterConfig }),
    [pagination, filterConfig],
  )

  const tableRows = useMemo(() => pagination.rows.map(toTableRow), [pagination.rows])

  const [drawerRow, setDrawerRow] = useState<CampaignLeadRow | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      }
      else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleSelectAll = useCallback((rowIds: string[], checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      rowIds.forEach(id => (checked ? next.add(id) : next.delete(id)))
      return next
    })
  }, [])

  const handleOpenProfile = useCallback(
    (customerId: string) => {
      setModal({
        accessor: 'CustomerProfile',
        Component: CustomerProfileModal,
        props: { customerId },
      })
      openModal()
    },
    [openModal, setModal],
  )

  const pageRowIds = useMemo(
    () => pagination.rows.map(r => r.customerId),
    [pagination.rows],
  )

  const columns = useMemo(() => buildLeadsColumns(), [])

  const meta = useMemo<LeadsTableMeta>(
    () => ({
      campaigns,
      onEnroll: (customerId: string) => enroll.mutate({ customerId }),
      onOpenProfile: handleOpenProfile,
      pageRowIds,
      selectedIds,
      toggleSelect,
      toggleSelectAll,
    }),
    [campaigns, enroll, handleOpenProfile, pageRowIds, selectedIds, toggleSelect, toggleSelectAll],
  )

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-3">
      <LeadsFilterBar pagination={toolbarPagination} />

      <div className="min-h-0 flex-1">
        <DataTable
          columns={columns}
          data={tableRows}
          entityName="lead"
          meta={meta}
          onRowClick={row => setDrawerRow(row)}
          serverPagination={toDataTablePagination(pagination)}
          tableId="campaign-leads"
        />
      </div>

      <LeadsBulkActionBar
        campaigns={campaigns}
        onClear={() => setSelectedIds(new Set())}
        selectedIds={[...selectedIds]}
      />

      <LeadDrawer
        campaigns={campaigns}
        onOpenChange={(open) => {
          if (!open) {
            setDrawerRow(null)
          }
        }}
        onOpenProfile={handleOpenProfile}
        row={drawerRow}
      />
    </div>
  )
}
