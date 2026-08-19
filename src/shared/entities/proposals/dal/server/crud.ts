import type { Proposal } from '@/shared/db/schema'

import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT, ThrowableDalError } from '@/shared/dal/server/types'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { recomputeProposalFinancials } from '@/shared/entities/proposals/dal/server/mutations'
import { getProposalLockSignals } from '@/shared/entities/proposals/dal/server/queries'
import { deriveProposalKind } from '@/shared/entities/proposals/lib/derive-proposal-kind'
import { generateShareToken } from '@/shared/entities/proposals/lib/generate-share-token'
import { isProposalFrozen, touchesFrozenLockedFields } from '@/shared/entities/proposals/lib/proposal-lock'
import { proposalServerSpec } from '@/shared/entities/proposals/lib/server-spec'
import { snapSowFromMeeting } from '@/shared/entities/proposals/lib/snap-sow-from-meeting'

/**
 * Stable CRUD handlers for the proposals entity. Hooks + duplicate config live
 * here (config factory), not on the spec — see ../../../meetings/dal/server/crud.ts
 * for the canonical shape.
 */
export const proposalCrud = createCrudDal(proposalServerSpec, () => ({
  hooks: {
    create: {
      // see ../DOCS.md#kind-derived-from-meeting-project
      // see ../DOCS.md#share-token-generated-at-insert
      // see ../DOCS.md#sow-snapshot-from-meeting-on-create
      // No blob scrub: `insertProposalSchema` omits the frozen blob columns
      // (fundingJSONDeprecated/formMetaJSONDeprecated) since the W3
      // write-seam flip, so nothing can arrive here to scrub.
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
      // startingTcp comes from the column; section terms from projectJSON
      // until W4).
      async after(row: Proposal, _ctx) {
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
      // Any write that moves a finalTcp input must re-converge the rollup:
      // the startingTcp column, or projectJSON (section incentives, until W4).
      // Cheap + idempotent; skipped when neither was touched.
      async after(row: Proposal, _ctx, meta) {
        if ('startingTcpCents' in meta.input || 'projectJSON' in meta.input) {
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
}))
