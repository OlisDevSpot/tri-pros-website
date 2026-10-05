import z from 'zod'

import { projectStatusBuckets, projectVisibilities } from '@/shared/constants/enums'
import { dateRange, defineFieldList, fixedOnly, multiSelect, select } from '@/shared/dal/lib/query/field-list'
import { PROJECT_STATUS_BUCKET_LABELS, PROJECT_VISIBILITY_LABELS } from '@/shared/modules/projects/core/constants/status-labels'

/** Every filterable and sortable projects field; each id is both the URL key suffix and the read's filter/sort key. */
export const PROJECT_FIELDS = defineFieldList({
  title: { label: 'Project', sort: true },
  customerName: { label: 'Customer', sort: true },
  city: { label: 'Location', sort: true },
  statusBucket: { label: 'Status', filter: multiSelect({ values: projectStatusBuckets, optionLabel: bucket => PROJECT_STATUS_BUCKET_LABELS[bucket] }) },
  visibility: { label: 'Visibility', filter: select({ values: projectVisibilities, optionLabel: visibility => PROJECT_VISIBILITY_LABELS[visibility] }), sort: true },
  completedAt: { label: 'Completed', filter: dateRange(), sort: true },
  createdAt: { label: 'Created', filter: dateRange(), sort: true },
  // Showcase-only projects never ran the lifecycle; the dashboard's work counts drop them.
  excludePortfolio: { filter: fixedOnly(z.boolean()) },
})
