import type { CustomerEnrichmentRow } from '@/shared/db/schema/customer-enrichment'
import type { CustomerLeadAttributionRow } from '@/shared/db/schema/customer-lead-attribution'
import type { ProfileFieldConfig } from '@/shared/entities/customers/types'

import { ClipboardListIcon } from 'lucide-react'

import { ProfileCard } from './profile-card'

interface Props {
  attribution: CustomerLeadAttributionRow | null
  enrichment: CustomerEnrichmentRow[]
}

export function FunnelIntakePanel({ attribution, enrichment }: Props) {
  // Enrichment rows are already `{label,value,order}`-shaped and DB-ordered
  // (queried `ORDER BY "order" ASC`), so they map straight onto the shared
  // ProfileCard's field/data contract — one consistent card for every section.
  if (attribution?.kind !== 'funnel' || enrichment.length === 0) {
    return null
  }

  const fields: ProfileFieldConfig[] = enrichment.map(row => ({
    id: row.stepId,
    label: row.label,
    type: 'text',
  }))
  const data = Object.fromEntries(enrichment.map(row => [row.stepId, row.value]))

  return (
    <ProfileCard title="Funnel Intake" icon={ClipboardListIcon} fields={fields} data={data} />
  )
}
