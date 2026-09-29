import z from 'zod'

import { meetingOutcomes, meetingTypes } from '@/shared/constants/enums'
import { proposalStatuses } from '@/shared/constants/enums/proposals'
import { dateRange, defineFieldList, multiSelect, select } from '@/shared/dal/lib/query/field-list'
import { PIPELINE_LABELS } from '@/shared/domains/pipelines/constants/pipeline-registry'
import { MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'
import { capitalize } from '@/shared/lib/formatters'

/** Every filterable and sortable meetings field; each id is both the URL key suffix and the read's filter/sort key. */
export const MEETING_FIELDS = defineFieldList({
  meetingType: { label: 'Meeting type', filter: multiSelect({ values: meetingTypes }), sort: true },
  proposalStatus: {
    label: 'Proposal status',
    filter: multiSelect({ values: ['none', ...proposalStatuses], optionLabel: status => (status === 'none' ? 'No proposal' : capitalize(status)) }),
  },
  trade: { label: 'Trade', filter: multiSelect({ schema: z.string().min(1), source: 'trades' }) },
  // User ids are free text, not uuids.
  rep: { label: 'Rep', filter: multiSelect({ schema: z.string().min(1), source: 'reps' }), sort: true },
  leadSource: { label: 'Lead source', filter: multiSelect({ schema: z.string().uuid(), source: 'leadSources' }), sort: true },
  createdAt: { label: 'Booked on', filter: dateRange(), sort: true },
  scheduledFor: { label: 'Scheduled', filter: dateRange(), sort: true },
  outcome: {
    label: 'Outcome',
    filter: multiSelect({ values: meetingOutcomes, optionLabel: outcome => MEETING_OUTCOME_LABELS[outcome] ?? outcome.replace(/_/g, ' ') }),
    sort: true,
  },
  customerName: { label: 'Customer', sort: true },
  pipeline: { label: 'Pipeline', filter: select({ values: ['projects', 'fresh', 'rehash', 'dead'], optionLabel: pipeline => PIPELINE_LABELS[pipeline] }) },
})
