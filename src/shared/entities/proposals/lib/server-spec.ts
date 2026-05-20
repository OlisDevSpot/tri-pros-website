import type { EntityServerSpec } from '@/shared/dal/server/types'

import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import {
  insertProposalSchema,
  proposals,
  selectProposalSchema,
} from '@/shared/db/schema'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { PROPOSAL } from '@/shared/entities/proposals/lib/constants'
import { deriveProposalKind } from '@/shared/entities/proposals/lib/derive-proposal-kind'
import { generateShareToken } from '@/shared/entities/proposals/lib/generate-share-token'
import { snapSowFromMeeting } from '@/shared/entities/proposals/lib/snap-sow-from-meeting'
import { proposalVisibility } from '@/shared/entities/proposals/lib/visibility'

// `kind` is server-derived (omitted from insert schema), so update inherits the exclusion.
const updateProposalSchema = insertProposalSchema.partial()

/** Concrete schemas for `createCrudRouter` type inference (spec carries type-erased copies). */
export const proposalSchemas = {
  insert: insertProposalSchema,
  update: updateProposalSchema,
}

export const proposalServerSpec = {
  entityName: PROPOSAL,
  caslSubject: PROPOSAL,
  visibility: proposalVisibility,
  table: proposals,
  schemas: {
    insert: insertProposalSchema,
    update: updateProposalSchema,
    select: selectProposalSchema,
  },
  shareable: { tokenColumn: 'token' },
  update: {
    // see ./DOCS.md#jsonb-merge-on-update
    jsonbMergeColumns: [
      proposals.formMetaJSON,
      proposals.projectJSON,
      proposals.fundingJSON,
    ] as const,
  },
  hooks: {
    create: {
      // see ../DOCS.md#kind-derived-from-meeting-project
      // see ../DOCS.md#share-token-generated-at-insert
      // see ../DOCS.md#sow-snapshot-from-meeting-on-create
      async before(input, ctx) {
        if (!input.meetingId) {
          return { ...input, kind: deriveProposalKind(null), token: generateShareToken() }
        }

        const meeting = dalVerifySuccess(
          await meetingCrud.getById(SYSTEM_CONTEXT, { id: input.meetingId }),
        )
        const kind = deriveProposalKind(meeting?.projectId ?? null)
        const token = generateShareToken()
        const enriched = snapSowFromMeeting(input, meeting?.flowStateJSON ?? null)

        return { ...enriched, kind, token }
      },
    },
  },

  // see ../DOCS.md#duplicate-resets-and-redrives
  // Default: copy full row minus PK. Exclude derived/status/timeline fields.
  // Routed through createImpl — create.before re-derives kind + generates fresh token.
  duplicate: {
    exclude: [
      'createdAt', 'updatedAt',
      'status', 'kind', 'token',
      'sentAt', 'approvedAt',
      'contractSentAt', 'contractViewedAt', 'contractSignedAt', 'contractDeclinedAt',
      'signingRequestId', 'qbInvoiceId', 'qbPaymentStatus',
    ],
    overrides: (source, ctx) => ({
      label: `Copy of ${source.label}`,
      ownerId: ctx.session!.user.id,
      status: 'draft' as const,
    }),
  },
} satisfies EntityServerSpec<typeof proposals>
