// ─── Proposal Business Mutations ────────────────────────────────────────────
// Custom CRUD overrides for the proposals entity. These replace the generic
// create/duplicate handlers with proposal-specific business logic (kind
// derivation, token generation, SOW snapshot from meeting trade selections).
//
// Every function returns DalReturn<T> — never throws. Uses dalDbOperation
// for DB error wrapping and ThrowableDalError for business logic errors.
//
// Consumed by the L1 crud router via handler overrides:
//   const handlers = { ...defaults, create: proposalCreateDal, duplicate: proposalDuplicateDal }

import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { InsertProposalView, ProposalView } from '@/shared/db/schema/proposal-views'
import type { Insert, Row } from '@/shared/db/types'

import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'

import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema/meetings'
import { proposalViews } from '@/shared/db/schema/proposal-views'
import { proposals } from '@/shared/db/schema/proposals'
import { proposalCrud } from '@/shared/entities/proposals/dal/server/crud'
import { createEmptySowSection } from '@/shared/entities/proposals/lib/create-empty-sow-section'
import { deriveProposalKind } from '@/shared/entities/proposals/lib/derive-proposal-kind'

// ── proposalCreateDal ───────────────────────────────────────────────────

export async function proposalCreateDal(
  _ctx: ScopedContext,
  input: Insert<typeof proposals>,
): Promise<DalReturn<Row<typeof proposals>>> {
  return dalDbOperation(async () => {
    // 1. Derive kind from meeting's project linkage
    let meetingProjectId: string | null = null
    let meetingFlowState: { tradeSelections?: Array<{ tradeId: string, tradeName: string, selectedScopes: Array<{ id: string, label: string }> }> } | null = null

    if (input.meetingId) {
      const [meetingRow] = await db
        .select({
          projectId: meetings.projectId,
          flowStateJSON: meetings.flowStateJSON,
        })
        .from(meetings)
        .where(eq(meetings.id, input.meetingId))

      meetingProjectId = meetingRow?.projectId ?? null
      meetingFlowState = meetingRow?.flowStateJSON ?? null
    }

    const kind = deriveProposalKind(meetingProjectId)

    // 2. Generate unique share token
    const token = `tpr-${randomBytes(8).toString('hex')}`

    // 3. Snapshot meeting trade selections into SOW (if present and SOW not already in input)
    let enrichedInput = input
    const tradeSelections = meetingFlowState?.tradeSelections
    if (tradeSelections && tradeSelections.length > 0) {
      const projectJSON = (input.projectJSON ?? {}) as Record<string, unknown>
      const data = (projectJSON.data ?? {}) as Record<string, unknown>

      if (!data.sow) {
        const sowFromSelections = tradeSelections.map(entry =>
          createEmptySowSection({
            trade: { id: entry.tradeId, label: entry.tradeName },
            scopes: entry.selectedScopes,
          }),
        )

        enrichedInput = {
          ...input,
          projectJSON: {
            ...projectJSON,
            data: {
              ...data,
              sow: sowFromSelections,
            },
          },
        } as typeof input
      }
    }

    // 4. Insert with server-derived fields
    const [row] = await db
      .insert(proposals)
      .values({
        ...enrichedInput,
        kind,
        token,
      })
      .returning()

    if (!row) {
      throw new ThrowableDalError({ type: 'create-failed' })
    }

    return row
  })
}

// ── proposalDuplicateDal ────────────────────────────────────────────────

export async function proposalDuplicateDal(
  ctx: ScopedContext,
  input: { id: string },
): Promise<DalReturn<Row<typeof proposals>>> {
  return dalDbOperation(async () => {
    const source = dalVerifySuccess(await proposalCrud.getById(ctx, input))

    if (!source) {
      throw new ThrowableDalError({ type: 'not-found' })
    }

    const duplicateData: Insert<typeof proposals> = {
      label: `Copy of ${source.label}`,
      ownerId: ctx.session!.user.id,
      status: 'draft' as const,
      formMetaJSON: source.formMetaJSON,
      projectJSON: source.projectJSON,
      fundingJSON: source.fundingJSON,
      financeOptionId: source.financeOptionId ?? undefined,
      meetingId: source.meetingId ?? undefined,
    } as Insert<typeof proposals>

    // Delegate to proposalCreateDal for kind derivation + token gen.
    // dalVerifySuccess unwraps or re-throws as ThrowableDalError.
    return dalVerifySuccess(await proposalCreateDal(ctx, duplicateData))
  })
}

// ── recordProposalView ─────────────────────────────────────────────────

/**
 * Records a proposal view event. Called from the public recordView procedure
 * when a homeowner opens their proposal link.
 */
export async function recordProposalView(
  input: InsertProposalView,
): Promise<DalReturn<ProposalView>> {
  return dalDbOperation(async () => {
    const [view] = await db.insert(proposalViews).values(input).returning()
    if (!view) {
      throw new ThrowableDalError({ type: 'create-failed' })
    }
    return view
  })
}
