import type { EntityToolkit } from '@/trpc/lib/create-entity-router'
import type { PgTable } from 'drizzle-orm/pg-core'

import { TRPCError } from '@trpc/server'
import { and, eq } from 'drizzle-orm'
import z from 'zod'

import { meetingParticipantRoles } from '@/shared/constants/enums'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { isUniqueViolation } from '@/shared/db/lib/pg-errors'
import { meetingParticipants } from '@/shared/db/schema'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import {
  addParticipant,
  countParticipantsByRole,
  getParticipantByRole,
  getParticipantsForMeeting,
  isParticipant,
  removeParticipant,
  updateParticipantRole,
} from '@/shared/entities/meetings/dal/server/participants'
import { getSystemOwnerId } from '@/shared/entities/users/dal/server/system'
import { notificationService } from '@/shared/services/notification.service'
import { schedulingService } from '@/shared/services/scheduling.service'
import { createTRPCRouter } from '@/trpc/init'

export function createParticipantsRouter(entity: EntityToolkit<PgTable>) {
  return createTRPCRouter({
    // Returns all participants for a meeting with user info (name, email, image).
    // Used by the inline ParticipantPicker and ManageParticipantsModal.
    // Super-admins (manage all) can read any meeting; agents can only read meetings
    // they are a participant of.
    // NOTE: scope middleware applies to `meetings` table, but getParticipantsForMeeting
    // queries `meetingParticipants` table directly — keep the explicit isParticipant check.
    getParticipants: entity.authedProcedure
      .input(z.object({ meetingId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const isOmni = ctx.ability.can('manage', 'all')

        if (!isOmni && !(await isParticipant(input.meetingId, ctx.session.user.id))) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have access to this meeting',
          })
        }

        return getParticipantsForMeeting(input.meetingId)
      }),

    // Manage meeting participants (add/remove/change role).
    // Only users with 'assign' permission on Meeting may call this.
    manageParticipants: entity.authedProcedure
      .input(z.object({
        meetingId: z.string().uuid(),
        action: z.enum(['add', 'remove', 'change_role']),
        userId: z.string().min(1),
        role: z.enum(meetingParticipantRoles).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.ability.cannot('assign', 'Meeting')) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only super-admins can manage meeting participants' })
        }

        const { meetingId, action, userId, role } = input

        if (action === 'add') {
          if (!role) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Role is required when adding a participant' })
          }

          // Pre-insert checks: fast-fail with friendly messages in the common
          // non-racing case. The DB-level partial unique indexes
          // (meeting_one_owner_idx, meeting_one_co_owner_idx) are the actual
          // race-safe enforcement — these checks are no longer load-bearing.
          if (role === 'owner') {
            const existingOwner = await getParticipantByRole(meetingId, 'owner')
            if (existingOwner && existingOwner.userId !== userId) {
              throw new TRPCError({ code: 'CONFLICT', message: 'Meeting already has an owner. Use change_role to swap.' })
            }
          }

          if (role === 'co_owner') {
            const coOwnerCount = await countParticipantsByRole(meetingId, 'co_owner')
            if (coOwnerCount >= 1) {
              throw new TRPCError({ code: 'CONFLICT', message: 'Meeting already has a co-owner.' })
            }
          }

          try {
            await addParticipant(meetingId, userId, role)
          }
          catch (err) {
            if (isUniqueViolation(err)) {
              if (role === 'owner') {
                throw new TRPCError({ code: 'CONFLICT', message: 'Meeting already has an owner.' })
              }
              if (role === 'co_owner') {
                throw new TRPCError({ code: 'CONFLICT', message: 'Meeting already has a co-owner.' })
              }
              // helper has no slot constraint — must be the (meeting_id, user_id)
              // collision (user already a participant in some role).
              throw new TRPCError({ code: 'CONFLICT', message: 'User is already a participant in this meeting.' })
            }
            throw err
          }

          if (role === 'owner') {
            dalVerifySuccess(await meetingCrud.update(ctx, { id: meetingId, data: { ownerId: userId } }))
          }

          // Fire-and-forget push to the new participant. Skip self-additions
          // (admin assigning themselves) — Linear/Asana/Slack semantics: you
          // don't notify yourself about your own actions. We don't await so
          // a slow push service never blocks the mutation response.
          if (userId !== ctx.session.user.id) {
            void notificationService
              .notifyMeetingParticipantAdded({ meetingId, participantUserId: userId })
              .catch(err => console.warn('[push] notifyMeetingParticipantAdded failed:', err))
          }
        }

        if (action === 'remove') {
          const existingOwner = await getParticipantByRole(meetingId, 'owner')
          const isRemovingOwner = existingOwner?.userId === userId

          if (isRemovingOwner) {
            const existingCoOwner = await getParticipantByRole(meetingId, 'co_owner')

            if (existingCoOwner) {
              // Promote co-owner to owner; remove the outgoing owner.
              await removeParticipant(meetingId, userId)
              await updateParticipantRole(meetingId, existingCoOwner.userId, 'owner')
              dalVerifySuccess(await meetingCrud.update(ctx, { id: meetingId, data: { ownerId: existingCoOwner.userId } }))
            }
            else {
              // No co-owner — fall back to system user (preserve prior behavior).
              await removeParticipant(meetingId, userId)
              const systemOwnerId = await getSystemOwnerId()
              await addParticipant(meetingId, systemOwnerId, 'owner')
              dalVerifySuccess(await meetingCrud.update(ctx, { id: meetingId, data: { ownerId: systemOwnerId } }))
            }
          }
          else {
            await removeParticipant(meetingId, userId)
          }
        }

        if (action === 'change_role') {
          if (!role) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Role is required when changing role' })
          }

          if (role === 'owner') {
            const currentOwner = await getParticipantByRole(meetingId, 'owner')
            if (currentOwner && currentOwner.userId !== userId) {
              // Demote current owner. If there's already a co_owner, remove the
              // outgoing owner instead of creating a 2-co_owner conflict.
              const existingCoOwner = await getParticipantByRole(meetingId, 'co_owner')
              if (existingCoOwner && existingCoOwner.userId !== userId) {
                await removeParticipant(meetingId, currentOwner.userId)
              }
              else {
                await updateParticipantRole(meetingId, currentOwner.userId, 'co_owner')
              }
            }
            // Upsert the incoming user as owner. They may already be a participant
            // (in any role), or they may not be in the table at all.
            const existingRow = await db.query.meetingParticipants.findFirst({
              where: and(
                eq(meetingParticipants.meetingId, meetingId),
                eq(meetingParticipants.userId, userId),
              ),
            })
            if (existingRow) {
              if (existingRow.role !== 'owner') {
                await updateParticipantRole(meetingId, userId, 'owner')
              }
            }
            else {
              try {
                await addParticipant(meetingId, userId, 'owner')
              }
              catch (err) {
                if (isUniqueViolation(err)) {
                  throw new TRPCError({ code: 'CONFLICT', message: 'Meeting already has an owner.' })
                }
                throw err
              }

              // Brand-new participant added via change_role → owner. Same
              // self-skip rule as the 'add' branch above. We deliberately
              // don't notify on the in-place promotion path (existingRow
              // branch above) — that user is already on the meeting and
              // would just see a noisy "you were added" for a role bump.
              if (userId !== ctx.session.user.id) {
                void notificationService
                  .notifyMeetingParticipantAdded({ meetingId, participantUserId: userId })
                  .catch(err => console.warn('[push] notifyMeetingParticipantAdded failed:', err))
              }
            }
            dalVerifySuccess(await meetingCrud.update(ctx, { id: meetingId, data: { ownerId: userId } }))
          }
          else if (role === 'co_owner') {
            const existingCoOwner = await getParticipantByRole(meetingId, 'co_owner')
            if (existingCoOwner && existingCoOwner.userId !== userId) {
              throw new TRPCError({ code: 'CONFLICT', message: 'Meeting already has a co-owner.' })
            }
            await updateParticipantRole(meetingId, userId, role)
          }
          else {
            await updateParticipantRole(meetingId, userId, role)
          }
        }

        // Push updated attendee list to Google Calendar
        const systemOwnerId = await getSystemOwnerId()
        await schedulingService
          .pushToGCal(systemOwnerId, 'meeting', meetingId)
          .catch(err => console.error(`[manageParticipants] GCal push failed for ${meetingId}:`, err))

        return { success: true }
      }),
  })
}
