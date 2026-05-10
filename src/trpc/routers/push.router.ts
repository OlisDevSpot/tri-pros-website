import z from 'zod'
import {
  deletePushSubscriptionForUser,
  upsertPushSubscription,
} from '@/shared/dal/server/push-subscriptions/api'
import { sendPushToUser } from '@/shared/services/push/send'
import { agentProcedure, createTRPCRouter, protectedProcedure } from '../init'

// Subscribe payload mirrors what `PushSubscription.toJSON()` returns in the
// browser. We accept it as-is so the client doesn't have to reshape; the
// DAL flattens it into table columns.
const subscribeInput = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
  }),
  userAgent: z.string().nullable().optional(),
  platform: z.string().nullable().optional(),
  // Set when the SW's `pushsubscriptionchange` event fires and the previous
  // endpoint should be cleaned up before upserting the new one.
  replacedEndpoint: z.string().nullable().optional(),
})

const unsubscribeInput = z.object({
  endpoint: z.string().url(),
})

export const pushRouter = createTRPCRouter({
  // Any signed-in user can subscribe their own device. Returns minimal info
  // to confirm the upsert; the client doesn't need the full row.
  subscribe: protectedProcedure
    .input(subscribeInput)
    .mutation(async ({ ctx, input }) => {
      const row = await upsertPushSubscription({
        userId: ctx.session.user.id,
        endpoint: input.subscription.endpoint,
        p256dh: input.subscription.keys.p256dh,
        auth: input.subscription.keys.auth,
        userAgent: input.userAgent ?? null,
        platform: input.platform ?? null,
        replacedEndpoint: input.replacedEndpoint ?? null,
      })
      return { id: row.id, endpoint: row.endpoint }
    }),

  // Scoped to caller — a user can only delete their own subscription.
  unsubscribe: protectedProcedure
    .input(unsubscribeInput)
    .mutation(async ({ ctx, input }) => {
      await deletePushSubscriptionForUser(ctx.session.user.id, input.endpoint)
      return { success: true as const }
    }),

  // Self-test: sends a notification to the caller's own subscriptions. Useful
  // for the "Send test" button in the manager UI. Gated to agentProcedure
  // because we don't want homeowners spamming themselves through our service
  // (and because today only agents have a dashboard to surface it from).
  sendTestToSelf: agentProcedure
    .input(z.object({
      navigate: z.string().default('/dashboard'),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await sendPushToUser(ctx.session.user.id, {
        title: 'Tri Pros — test notification',
        body: 'Tap to deep-link into the app.',
        navigate: input.navigate,
        urgency: 'high',
      })
      return result
    }),
})
