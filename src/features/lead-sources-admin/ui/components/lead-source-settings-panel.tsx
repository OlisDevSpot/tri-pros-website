'use client'

import type { AppRouterOutputs } from '@/trpc/routers/app'

import { useQuery } from '@tanstack/react-query'

import { DangerZone } from '@/features/lead-sources-admin/ui/components/danger-zone'
import { FormConfigEditor } from '@/features/lead-sources-admin/ui/components/form-config-editor'
import { IdentityEditor } from '@/features/lead-sources-admin/ui/components/identity-editor'
import { IntakeUrlCard } from '@/features/lead-sources-admin/ui/components/intake-url-card'
import { useTRPC } from '@/trpc/helpers'

type LeadSource = AppRouterOutputs['leadSourcesRouter']['getById']

interface LeadSourceSettingsPanelProps {
  source: LeadSource
}

export function LeadSourceSettingsPanel({ source }: LeadSourceSettingsPanelProps) {
  const trpc = useTRPC()

  const countsQuery = useQuery(
    trpc.leadSourcesRouter.getStatusCounts.queryOptions({ id: source.id }),
  )
  const customerCount = countsQuery.data?.all ?? 0

  return (
    <div className="flex flex-col gap-6">
      <IdentityEditor
        key={source.id}
        leadSourceId={source.id}
        initialName={source.name}
        initialSlug={source.slug}
      />

      <div className="border-t border-border/40 pt-6">
        <IntakeUrlCard leadSourceId={source.id} slug={source.slug} token={source.token} />
      </div>

      <div className="border-t border-border/40 pt-6">
        <FormConfigEditor leadSourceId={source.id} initial={source.formConfigJSON} />
      </div>

      <div className="border-t border-border/40 pt-6">
        <DangerZone
          leadSourceId={source.id}
          slug={source.slug}
          isActive={source.isActive}
          customerCount={customerCount}
        />
      </div>
    </div>
  )
}
