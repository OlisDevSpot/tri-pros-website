// Application entity DAL mutations. Business-specific operations beyond CRUD.
// DAL conventions: docs/codebase-conventions/dal-conventions.md

import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { Application } from '@/shared/db/schema/applications'
import type { ApplicationDraft } from '@/shared/entities/applications/schemas'

import { and, eq, sql } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { applicationAnswers } from '@/shared/db/schema/application-answers'
import { applications } from '@/shared/db/schema/applications'
import { x_applicationTrades } from '@/shared/db/schema/x-application-trades'
import { TRADES_QUESTION_KEY } from '@/shared/entities/applications/lib/constants'
import { applicationDraftSchema } from '@/shared/entities/applications/schemas'

// ── saveDraft ─────────────────────────────────────────────────────────────

/**
 * Autosave target for the engine (sub-project #2's DB adapter). Debounced,
 * idempotent. Only a draft may be autosaved — a submitted/withdrawn
 * application is immutable via this path. see ../../DOCS.md#draft-commit-split
 */
export async function saveDraft(
  ctx: ScopedContext,
  input: { applicationId: string, state: ApplicationDraft },
): Promise<DalReturn<Application>> {
  return dalDbOperation(async () => {
    const [application] = await db
      .select({ id: applications.id, status: applications.status })
      .from(applications)
      .where(and(eq(applications.id, input.applicationId), ctx.scope ?? undefined))
    if (!application) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    if (application.status !== 'draft') {
      throw new ThrowableDalError({ type: 'precondition-failed', reason: 'application_not_draft' })
    }
    const draftAnswersJSON = applicationDraftSchema.parse(input.state)
    const [row] = await db.update(applications)
      .set({ draftAnswersJSON })
      .where(eq(applications.id, input.applicationId))
      .returning()
    if (!row) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    return row
  })
}

// ── submitApplication ───────────────────────────────────────────────────────

/**
 * The draft→commit split. In one transaction: explode draftAnswersJSON.answers
 * into application_answers rows (idempotent upsert) + route the reserved
 * TRADES_QUESTION_KEY value to x_application_trades, then flip status to
 * 'submitted'. draftAnswersJSON is LEFT INTACT (inert record). Only a draft
 * may be submitted. see ../../DOCS.md#draft-commit-split
 */
export async function submitApplication(
  ctx: ScopedContext,
  input: { applicationId: string },
): Promise<DalReturn<Application>> {
  return dalDbOperation(async () => {
    const [application] = await db
      .select({
        id: applications.id,
        status: applications.status,
        draftAnswersJSON: applications.draftAnswersJSON,
      })
      .from(applications)
      .where(and(eq(applications.id, input.applicationId), ctx.scope ?? undefined))
    if (!application) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    if (application.status !== 'draft') {
      throw new ThrowableDalError({ type: 'precondition-failed', reason: 'application_not_draft' })
    }
    if (!application.draftAnswersJSON) {
      throw new ThrowableDalError({ type: 'precondition-failed', reason: 'nothing_to_submit' })
    }

    const { answers } = applicationDraftSchema.parse(application.draftAnswersJSON)

    // Split answers: reserved trades key → junction; everything else → answer rows.
    // Trades are Notion-managed: the reserved key holds { tradeId (Notion page
    // UUID), tradeName } objects — NOT Postgres trade ids. see ../../DOCS.md#trades-question-key-seam
    const answerRows: { applicationId: string, questionKey: string, value: string, position: number }[] = []
    let tradeSelections: { tradeId: string, tradeName: string }[] = []
    let position = 0
    for (const [questionKey, raw] of Object.entries(answers)) {
      if (questionKey === TRADES_QUESTION_KEY) {
        tradeSelections = Array.isArray(raw)
          ? raw.filter(
              (t): t is { tradeId: string, tradeName: string } =>
                t != null
                && typeof t === 'object'
                && typeof (t as { tradeId?: unknown }).tradeId === 'string'
                && typeof (t as { tradeName?: unknown }).tradeName === 'string',
            )
          : []
        continue
      }
      answerRows.push({
        applicationId: input.applicationId,
        questionKey,
        value: String(raw ?? ''),
        position: position++,
      })
    }

    const submittedAt = new Date().toISOString()

    const [row] = await db.transaction(async (tx) => {
      if (answerRows.length > 0) {
        await tx.insert(applicationAnswers)
          .values(answerRows)
          .onConflictDoUpdate({
            target: [applicationAnswers.applicationId, applicationAnswers.questionKey],
            set: {
              value: sql`excluded.value`,
              position: sql`excluded.position`,
            },
          })
      }
      if (tradeSelections.length > 0) {
        await tx.insert(x_applicationTrades)
          .values(tradeSelections.map(t => ({
            applicationId: input.applicationId,
            tradeId: t.tradeId,
            tradeName: t.tradeName,
          })))
          .onConflictDoNothing()
      }
      return tx.update(applications)
        .set({ status: 'submitted', submittedAt })
        .where(eq(applications.id, input.applicationId))
        .returning()
    })
    if (!row) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    return row
  })
}

// ── withdraw ────────────────────────────────────────────────────────────────

/**
 * Pre-decision abandon. A draft or submitted application may be withdrawn.
 * see ../../DOCS.md#lifecycle
 */
export async function withdraw(
  ctx: ScopedContext,
  input: { applicationId: string },
): Promise<DalReturn<Application>> {
  return dalDbOperation(async () => {
    const [application] = await db
      .select({ id: applications.id, status: applications.status })
      .from(applications)
      .where(and(eq(applications.id, input.applicationId), ctx.scope ?? undefined))
    if (!application) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    if (application.status !== 'draft' && application.status !== 'submitted') {
      throw new ThrowableDalError({ type: 'precondition-failed', reason: 'application_not_withdrawable' })
    }
    const [row] = await db.update(applications)
      .set({ status: 'withdrawn' })
      .where(eq(applications.id, input.applicationId))
      .returning()
    if (!row) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    return row
  })
}
