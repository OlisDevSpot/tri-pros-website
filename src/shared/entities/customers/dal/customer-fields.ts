import z from 'zod'

import { pipelines } from '@/shared/constants/enums/pipelines'
import { dateRange, defineFieldList, fixedOnly, multiSelect } from '@/shared/dal/lib/query/field-list'
import { PIPELINE_LABELS } from '@/shared/domains/pipelines/constants/pipeline-registry'
import { customerSegments } from '@/shared/entities/lead-sources/constants/customer-segments'

/** Every filterable and sortable customers field; each id is both the URL key suffix and the read's filter/sort key. */
export const CUSTOMER_FIELDS = defineFieldList({
  pipeline: { label: 'Pipeline', filter: multiSelect({ values: pipelines, optionLabel: pipeline => PIPELINE_LABELS[pipeline] }) },
  createdAt: { label: 'Created', filter: dateRange(), sort: true },
  // User ids are free text, not uuids.
  rep: { label: 'Rep', filter: multiSelect({ schema: z.string().min(1), source: 'reps' }) },
  leadSource: { label: 'Lead source', filter: multiSelect({ schema: z.string().uuid(), source: 'leadSources' }), sort: true },
  name: { label: 'Name', sort: true },
  email: { label: 'Email', sort: true },
  sourceId: { filter: fixedOnly(z.string().uuid()) },
  segment: { filter: fixedOnly(z.enum(customerSegments)) },
})
