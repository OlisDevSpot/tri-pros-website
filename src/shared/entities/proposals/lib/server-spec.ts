import type { EntityServerSpec } from '@/shared/dal/server/types'

import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT, ThrowableDalError } from '@/shared/dal/server/types'
import {
  insertProposalSchema,
  proposals,
  selectProposalSchema,
} from '@/shared/db/schema'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { recomputeProposalFinancials } from '@/shared/entities/proposals/dal/server/mutations'
import { getProposalLockSignals } from '@/shared/entities/proposals/dal/server/queries'
import { PROPOSAL } from '@/shared/entities/proposals/lib/constants'
import { deriveProposalKind } from '@/shared/entities/proposals/lib/derive-proposal-kind'
import { generateShareToken } from '@/shared/entities/proposals/lib/generate-share-token'
import { isProposalFrozen, touchesFrozenLockedFields } from '@/shared/entities/proposals/lib/proposal-lock'
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
  hooks: {
    create: {
      // see ../DOCS.md#kind-derived-from-meeting-project
      // see ../DOCS.md#share-token-generated-at-insert
      // see ../DOCS.md#sow-snapshot-from-meeting-on-create
      async before(input, _ctx) {
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
      // New proposals get their rollup immediately (rows are empty at create;
      // startingTcp/section terms come from the blobs until W3).
      async after(row, _ctx) {
        dalVerifySuccess(await recomputeProposalFinancials(row.id))
      },
    },
    update: {
      // Whole-proposal lock ladder (#264): any envelope (draft or beyond) or
      // terminal status makes user-authored content immutable — the sanctioned
      // edit path kills the envelope first (discard/recall). Field-scoped so
      // lifecycle writes (status, signing ids, contract timestamps — webhooks,
      // auto-approve, send flows) keep flowing on a locked proposal.
      // see ../DOCS.md#proposal-lock-ladder
      async before(input, _ctx, meta) {
        if (!touchesFrozenLockedFields(input)) {
          return input
        }
        const signals = dalVerifySuccess(await getProposalLockSignals(String(meta.id)))
        if (isProposalFrozen(signals)) {
          throw new ThrowableDalError({ type: 'precondition-failed', reason: 'proposal_frozen' })
        }
        return input
      },
      // Whole-document fundingJSON/projectJSON writes must re-converge the
      // rollup. Cheap + idempotent; skipped when neither blob was touched.
      async after(row, _ctx, meta) {
        if ('fundingJSON' in meta.input || 'projectJSON' in meta.input) {
          dalVerifySuccess(await recomputeProposalFinancials(row.id))
        }
      },
    },
  },

  // see ../DOCS.md#duplicate-resets-and-redrives
  // Default: copy full row minus PK. Exclude derived/status/timeline fields.
  // Routed through createImpl — create.before re-derives kind + generates fresh token.
  duplicate: {
    exclude: [
      'createdAt',
      'updatedAt',
      'status',
      'kind',
      'token',
      'sentAt',
      'approvedAt',
      'contractSentAt',
      'contractViewedAt',
      'contractSignedAt',
      'contractDeclinedAt',
      'contractEnvelopeId',
      'qbInvoiceId',
      'qbPaymentStatus',
    ],
    overrides: (source, ctx) => ({
      label: `Copy of ${source.label}`,
      ownerId: ctx.session!.user.id,
      status: 'draft' as const,
    }),
  },
} satisfies EntityServerSpec<typeof proposals>
