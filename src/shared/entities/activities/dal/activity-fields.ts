import z from 'zod'

import { activityEntityTypes, activityTypes } from '@/shared/constants/enums'
import { dateRange, defineFieldList, multiSelect } from '@/shared/dal/lib/query/field-list'
import { capitalize } from '@/shared/lib/formatters'

/** Every filterable and sortable activities field; each id is both the URL key suffix and the read's filter/sort key. */
export const ACTIVITY_FIELDS = defineFieldList({
  type: { label: 'Type', filter: multiSelect({ values: activityTypes, optionLabel: capitalize }), sort: true },
  entityType: { label: 'Related to', filter: multiSelect({ values: activityEntityTypes, optionLabel: capitalize }) },
  // User ids are free text, not uuids.
  ownerId: { label: 'Owner', filter: multiSelect({ schema: z.string().min(1), source: 'reps' }) },
  scheduledFor: { label: 'Scheduled', filter: dateRange(), sort: true },
  title: { label: 'Title', sort: true },
  dueAt: { label: 'Due', sort: true },
  createdAt: { label: 'Created', sort: true },
})
