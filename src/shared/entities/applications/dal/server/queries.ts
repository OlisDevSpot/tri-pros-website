// Application entity DAL reads. see docs/codebase-conventions/dal-conventions.md

import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { ApplicationAnswer } from '@/shared/db/schema/application-answers'
import type { Application } from '@/shared/db/schema/applications'

import { and, asc, eq } from 'drizzle-orm'
import z from 'zod'

import { applicationStatuses, applicationTypes } from '@/shared/constants/enums'
import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { applicationAnswers } from '@/shared/db/schema/application-answers'
import { applications } from '@/shared/db/schema/applications'
import { x_applicationTrades } from '@/shared/db/schema/x-application-trades'

export const applicationListInputSchema = z.object({
  meetingId: z.string().uuid().optional(),
  type: z.enum(applicationTypes).optional(),
  status: z.enum(applicationStatuses).optional(),
}).default({})
export type ApplicationListInput = z.infer<typeof applicationListInputSchema>

export async function listApplications(
  ctx: ScopedContext,
  input: ApplicationListInput,
): Promise<DalReturn<Application[]>> {
  return dalDbOperation(async () => {
    const filters = [
      ctx.scope ?? undefined,
      input.meetingId ? eq(applications.meetingId, input.meetingId) : undefined,
      input.type ? eq(applications.type, input.type) : undefined,
      input.status ? eq(applications.status, input.status) : undefined,
    ]
    return db.select()
      .from(applications)
      .where(and(...filters))
      .orderBy(asc(applications.createdAt))
  })
}

export interface ApplicationWithAnswers extends Application {
  answers: ApplicationAnswer[]
  tradeIds: number[]
}

/** Parent + committed answers + selected trade ids, for the review panel (#3). */
export async function getApplicationWithAnswers(
  ctx: ScopedContext,
  input: { applicationId: string },
): Promise<DalReturn<ApplicationWithAnswers>> {
  return dalDbOperation(async () => {
    const [application] = await db.select()
      .from(applications)
      .where(and(eq(applications.id, input.applicationId), ctx.scope ?? undefined))
    if (!application) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    const answers = await db.select()
      .from(applicationAnswers)
      .where(eq(applicationAnswers.applicationId, input.applicationId))
      .orderBy(asc(applicationAnswers.position))
    const tradeRows = await db.select({ tradeId: x_applicationTrades.tradeId })
      .from(x_applicationTrades)
      .where(eq(x_applicationTrades.applicationId, input.applicationId))
    return { ...application, answers, tradeIds: tradeRows.map(r => r.tradeId) }
  })
}
